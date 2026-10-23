package com.swiftkite.services.implementation;

import com.swiftkite.entity.NotificationDelivery;
import com.swiftkite.enums.DeliveryStatus;
import com.swiftkite.enums.FailureCode;
import com.swiftkite.enums.InboxStatus;
import com.swiftkite.exception.AppException;
import com.swiftkite.provider.ResendWebhookVerifier;
import com.swiftkite.repository.NotificationDeliveryRepository;
import com.swiftkite.repository.WebhookInboxRepository;
import com.swiftkite.services.interfaces.IWebhookService;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Provider webhook intake: verify, deduplicate, repair delivery status. */
@Service
@Slf4j
public class WebhookService implements IWebhookService {

    private static final String PROVIDER = "resend";
    private static final String DELIVERY_TAG = "delivery_id";
    private static final String DELIVERY_HEADER = "X-SwiftKite-Delivery-Id";

    private final ResendWebhookVerifier verifier;
    private final WebhookInboxRepository inboxRepository;
    private final NotificationDeliveryRepository deliveryRepository;
    private final ObjectMapper objectMapper;

    public WebhookService(
            ResendWebhookVerifier verifier,
            WebhookInboxRepository inboxRepository,
            NotificationDeliveryRepository deliveryRepository,
            ObjectMapper objectMapper) {
        this.verifier = verifier;
        this.inboxRepository = inboxRepository;
        this.deliveryRepository = deliveryRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void handleEmailWebhook(
            String svixId, String svixTimestamp, String svixSignature, byte[] body) {
        byte[] rawBody = body == null ? new byte[0] : body;
        verifier.verify(svixId, svixTimestamp, svixSignature, rawBody);

        String raw = new String(rawBody, StandardCharsets.UTF_8);
        JsonNode root;
        try {
            root = objectMapper.readTree(raw);
        } catch (Exception ex) {
            throw new AppException("Invalid webhook payload.", HttpStatus.BAD_REQUEST);
        }

        Optional<UUID> inserted = inboxRepository.tryInsert(PROVIDER, svixId, raw);
        if (inserted.isEmpty()) {
            log.debug("Ignoring duplicate Resend webhook event {}", svixId);
            return;
        }
        UUID inboxId = inserted.get();

        String eventType = text(root, "type");
        DeliveryStatus target = targetStatus(eventType);
        if (target == null) {
            inboxRepository.markStatus(inboxId, InboxStatus.IGNORED);
            log.debug("Ignoring unsupported Resend event type {}", eventType);
            return;
        }

        JsonNode data = root.path("data");
        String providerMessageId = text(data, "email_id");
        if (isBlank(providerMessageId)) {
            providerMessageId = text(data, "id");
        }
        UUID deliveryId = extractDeliveryId(data);

        Optional<NotificationDelivery> found = findDelivery(providerMessageId, deliveryId);
        if (found.isEmpty()) {
            inboxRepository.markStatus(inboxId, InboxStatus.IGNORED);
            log.warn(
                    "Resend webhook {} references no delivery (messageId={}, deliveryId={})",
                    svixId,
                    providerMessageId,
                    deliveryId);
            return;
        }

        NotificationDelivery delivery = found.get();
        if (canAdvance(delivery, target)) {
            delivery.setStatus(target);
            if (delivery.getFailureCode() != null) {
                delivery.setFailureCode(null);
                delivery.setDetail(null);
            }
            if (isBlank(delivery.getProviderMessageId()) && !isBlank(providerMessageId)) {
                delivery.setProviderMessageId(providerMessageId);
            }
            deliveryRepository.save(delivery);
        } else {
            log.debug(
                    "Webhook {} would move delivery {} backwards; keeping {}",
                    svixId,
                    delivery.getId(),
                    delivery.getStatus());
        }

        inboxRepository.markStatus(inboxId, InboxStatus.PROCESSED);
    }

    private Optional<NotificationDelivery> findDelivery(
            String providerMessageId, UUID deliveryId) {
        Optional<NotificationDelivery> found = Optional.empty();
        if (!isBlank(providerMessageId)) {
            found = deliveryRepository.findByProviderMessageIdForUpdate(providerMessageId);
        }
        if (found.isEmpty() && deliveryId != null) {
            found = deliveryRepository.findByIdForUpdate(deliveryId);
        }
        return found;
    }

    private static DeliveryStatus targetStatus(String eventType) {
        if (eventType == null) {
            return null;
        }
        return switch (eventType) {
            case "email.delivered" -> DeliveryStatus.DELIVERED;
            case "email.bounced" -> DeliveryStatus.BOUNCED;
            case "email.complained" -> DeliveryStatus.COMPLAINED;
            default -> null;
        };
    }

    private static boolean canAdvance(NotificationDelivery delivery, DeliveryStatus target) {
        DeliveryStatus current = delivery.getStatus();
        if (current == DeliveryStatus.CANCELLED) {
            return false;
        }
        if (current == DeliveryStatus.FAILED) {
            return delivery.getFailureCode() == FailureCode.OUTCOME_UNKNOWN;
        }
        if (current == DeliveryStatus.PENDING || current == DeliveryStatus.ATTEMPTING) {
            return true;
        }
        int currentRank = rank(current);
        return currentRank >= 0 && rank(target) > currentRank;
    }

    private static int rank(DeliveryStatus status) {
        return switch (status) {
            case ACCEPTED -> 0;
            case DELIVERED -> 1;
            case BOUNCED -> 2;
            case COMPLAINED -> 3;
            default -> -1;
        };
    }

    private static UUID extractDeliveryId(JsonNode data) {
        UUID fromTags = findDeliveryId(data.get("tags"), DELIVERY_TAG, false);
        if (fromTags != null) {
            return fromTags;
        }
        return findDeliveryId(data.get("headers"), DELIVERY_HEADER, true);
    }

    private static UUID findDeliveryId(JsonNode array, String expectedName, boolean ignoreCase) {
        if (array == null || !array.isArray()) {
            return null;
        }
        for (JsonNode item : array) {
            String name = text(item, "name");
            if (name == null) {
                continue;
            }
            boolean matches = ignoreCase
                    ? expectedName.equalsIgnoreCase(name)
                    : expectedName.equals(name);
            if (!matches) {
                continue;
            }
            String value = text(item, "value");
            if (isBlank(value)) {
                continue;
            }
            try {
                return UUID.fromString(value);
            } catch (IllegalArgumentException ex) {
                // Try the next tag/header if this one is malformed.
            }
        }
        return null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
