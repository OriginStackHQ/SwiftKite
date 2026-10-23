package com.swiftkite.services.implementation;

import com.swiftkite.dto.campaign.CampaignDefaultsResponse;
import com.swiftkite.dto.campaign.CampaignDetailResponse;
import com.swiftkite.dto.campaign.CampaignResponse;
import com.swiftkite.dto.campaign.CampaignSummaryResponse;
import com.swiftkite.config.RabbitConfig;
import com.swiftkite.dto.campaign.CampaignWriteRequest;
import com.swiftkite.dto.campaign.CreateCampaignRequest;
import com.swiftkite.dto.campaign.SendCampaignResponse;
import com.swiftkite.dto.campaign.UpdateCampaignRequest;
import com.swiftkite.dto.common.PageResponse;
import com.swiftkite.entity.Campaign;
import com.swiftkite.entity.CampaignRecipient;
import com.swiftkite.entity.NotificationDelivery;
import com.swiftkite.entity.OutboxEvent;
import com.swiftkite.enums.CampaignStatus;
import com.swiftkite.enums.DeliveryStatus;
import com.swiftkite.enums.PausedReason;
import com.swiftkite.exception.AppException;
import com.swiftkite.exception.MissingPlaceholderException;
import com.swiftkite.exception.NotFoundException;
import com.swiftkite.repository.CampaignRecipientRepository;
import com.swiftkite.repository.CampaignRepository;
import com.swiftkite.repository.NotificationDeliveryRepository;
import com.swiftkite.repository.OutboxEventRepository;
import com.swiftkite.services.interfaces.ICampaignService;
import com.swiftkite.util.Pagination;
import com.swiftkite.util.PlaceholderExtractor;
import com.swiftkite.util.TemplateRenderer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class CampaignService implements ICampaignService {

    private static final List<CampaignStatus> DELETABLE_STATUSES =
            List.of(CampaignStatus.DRAFT, CampaignStatus.COMPLETED, CampaignStatus.STOPPED);

    private final CampaignRepository campaignRepository;
    private final CampaignRecipientRepository recipientRepository;
    private final NotificationDeliveryRepository deliveryRepository;
    private final OutboxEventRepository outboxRepository;
    private final JdbcTemplate jdbcTemplate;
    private final String defaultFromEmail;
    private final String defaultFromName;

    public CampaignService(
            CampaignRepository campaignRepository,
            CampaignRecipientRepository recipientRepository,
            NotificationDeliveryRepository deliveryRepository,
            OutboxEventRepository outboxRepository,
            JdbcTemplate jdbcTemplate,
            @Value("${app.mail.from-email}") String defaultFromEmail,
            @Value("${app.mail.from-name}") String defaultFromName) {
        this.campaignRepository = campaignRepository;
        this.recipientRepository = recipientRepository;
        this.deliveryRepository = deliveryRepository;
        this.outboxRepository = outboxRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.defaultFromEmail = normalizeEmail(defaultFromEmail);
        this.defaultFromName = defaultFromName;
    }

    @Override
    @Transactional
    public CampaignResponse create(UUID userId, CreateCampaignRequest request) {
        Campaign campaign = new Campaign();
        campaign.setUserId(userId);
        apply(campaign, request);
        campaign.setStatus(CampaignStatus.DRAFT);
        return toResponse(campaignRepository.save(campaign));
    }

    @Override
    public CampaignDefaultsResponse defaults() {
        return new CampaignDefaultsResponse(defaultFromEmail, defaultFromName);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CampaignSummaryResponse> list(UUID userId, int page, int size) {
        Page<Campaign> campaigns = campaignRepository.findByUserId(
                userId, Pagination.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.from(campaigns.map(this::toSummary));
    }

    @Override
    @Transactional(readOnly = true)
    public CampaignDetailResponse get(UUID userId, UUID campaignId) {
        Campaign campaign = requireOwned(campaignId, userId);
        return toDetail(campaign);
    }

    @Override
    @Transactional
    public CampaignResponse update(UUID userId, UUID campaignId, UpdateCampaignRequest request) {
        String name = request.getName().trim();
        String subjectTemplate = request.getSubjectTemplate().trim();
        String previewText = blankToNull(request.getPreviewText());
        String bodyTemplate = request.getBodyTemplate();
        String fromEmail = defaultFromEmail;
        String fromName = blankToNull(request.getFromName());

        requireNoEmptyPlaceholders(subjectTemplate, "subject");
        requireNoEmptyPlaceholders(bodyTemplate, "body");

        int updated = campaignRepository.updateDraft(
                campaignId,
                userId,
                CampaignStatus.DRAFT,
                name,
                subjectTemplate,
                previewText,
                bodyTemplate,
                fromEmail,
                fromName);

        if (updated == 0) {
            requireOwned(campaignId, userId);
            throw new AppException("Only DRAFT campaigns can be edited.", HttpStatus.CONFLICT);
        }

        return toResponse(requireOwned(campaignId, userId));
    }

    @Override
    @Transactional
    public SendCampaignResponse send(UUID userId, UUID campaignId) {
        Campaign campaign = campaignRepository
                .findByIdAndUserIdForUpdate(campaignId, userId)
                .orElseThrow(() -> new NotFoundException("Campaign not found."));

        if (campaign.getStatus() != CampaignStatus.DRAFT) {
            throw new AppException("Only DRAFT campaigns can be sent.", HttpStatus.CONFLICT);
        }

        List<CampaignRecipient> recipients =
                recipientRepository.findByCampaignIdOrderById(campaignId);
        if (recipients.isEmpty()) {
            throw new AppException(
                    "Add at least one recipient before sending.", HttpStatus.BAD_REQUEST);
        }

        requireNoEmptyPlaceholders(campaign.getSubjectTemplate(), "subject");
        requireNoEmptyPlaceholders(campaign.getBodyTemplate(), "body");

        // Validate and render before changing state. If anything is missing the
        // transaction throws and the campaign stays DRAFT.
        List<NotificationDelivery> deliveries = new ArrayList<>(recipients.size());
        List<MissingPlaceholderException.MissingPlaceholder> missing = new ArrayList<>();

        for (CampaignRecipient recipient : recipients) {
            Map<String, Object> data = recipient.getData() == null ? Map.of() : recipient.getData();
            String email = recipient.getEmail();

            Set<String> missingKeys = new LinkedHashSet<>();
            missingKeys.addAll(
                    TemplateRenderer.missingKeys(campaign.getSubjectTemplate(), data, email));
            missingKeys.addAll(
                    TemplateRenderer.missingKeys(campaign.getBodyTemplate(), data, email));

            if (!missingKeys.isEmpty()) {
                missing.add(new MissingPlaceholderException.MissingPlaceholder(
                        recipient.getId(), email, Set.copyOf(missingKeys)));
                continue;
            }

            String renderedSubject = TemplateRenderer
                    .render(campaign.getSubjectTemplate(), data, email, false)
                    .value();
            String renderedBody = TemplateRenderer
                    .render(campaign.getBodyTemplate(), data, email, true)
                    .value();

            NotificationDelivery delivery = new NotificationDelivery();
            delivery.setCampaignId(campaignId);
            delivery.setRecipientId(recipient.getId());
            delivery.setEmail(email);
            delivery.setRenderedSubject(renderedSubject);
            delivery.setRenderedBody(renderedBody);
            delivery.setStatus(DeliveryStatus.PENDING);
            deliveries.add(delivery);
        }

        if (!missing.isEmpty()) {
            throw new MissingPlaceholderException(missing);
        }

        int updated = campaignRepository.markSending(
                campaignId, userId, CampaignStatus.DRAFT, CampaignStatus.SENDING);
        if (updated == 0) {
            throw new AppException("Campaign is no longer in DRAFT.", HttpStatus.CONFLICT);
        }

        deliveryRepository.saveAll(deliveries);
        publishWakeUps(campaignId, wakeUpCount(recipients.size()));

        return new SendCampaignResponse(campaignId, CampaignStatus.SENDING, recipients.size());
    }

    @Override
    @Transactional
    public CampaignResponse pause(UUID userId, UUID campaignId) {
        int updated = campaignRepository.pause(
                campaignId,
                userId,
                CampaignStatus.SENDING,
                CampaignStatus.PAUSED,
                PausedReason.USER);

        if (updated == 0) {
            requireOwned(campaignId, userId);
            throw new AppException("Only SENDING campaigns can be paused.", HttpStatus.CONFLICT);
        }

        return toResponse(requireOwned(campaignId, userId));
    }

    @Override
    @Transactional
    public CampaignResponse resume(UUID userId, UUID campaignId) {
        int updated = campaignRepository.resume(
                campaignId,
                userId,
                CampaignStatus.PAUSED,
                CampaignStatus.SENDING);

        if (updated == 0) {
            requireOwned(campaignId, userId);
            throw new AppException("Only PAUSED campaigns can be resumed.", HttpStatus.CONFLICT);
        }

        long pending =
                deliveryRepository.countByCampaignIdAndStatus(campaignId, DeliveryStatus.PENDING);
        publishWakeUps(campaignId, wakeUpCount(pending));

        return toResponse(requireOwned(campaignId, userId));
    }

    @Override
    @Transactional
    public CampaignResponse stop(UUID userId, UUID campaignId) {
        int updated = campaignRepository.markStopping(
                campaignId,
                userId,
                List.of(CampaignStatus.SENDING, CampaignStatus.PAUSED),
                CampaignStatus.STOPPING);

        if (updated == 0) {
            requireOwned(campaignId, userId);
            throw new AppException(
                    "Only running or paused campaigns can be stopped.", HttpStatus.CONFLICT);
        }

        deliveryRepository.cancelPendingByCampaignId(campaignId);
        campaignRepository.markStoppedIfNoWorkLeft(campaignId);

        return toResponse(requireOwned(campaignId, userId));
    }

    @Override
    @Transactional
    public void delete(UUID userId, UUID campaignId) {
        int deleted = campaignRepository.deleteByIdAndUserIdAndStatusIn(
                campaignId, userId, DELETABLE_STATUSES);

        if (deleted == 0) {
            requireOwned(campaignId, userId);
            throw new AppException("Stop the campaign before deleting it.", HttpStatus.CONFLICT);
        }

        outboxRepository.deleteUnpublishedByAggregateId(campaignId);
    }

    private static void requireNoEmptyPlaceholders(String template, String field) {
        if (PlaceholderExtractor.hasEmptyPlaceholder(template)) {
            throw new AppException(
                    "Remove empty placeholders such as {{}} from the " + field + ".",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private Campaign requireOwned(UUID campaignId, UUID userId) {
        return campaignRepository
                .findByIdAndUserId(campaignId, userId)
                .orElseThrow(() -> new NotFoundException("Campaign not found."));
    }

    private void apply(Campaign campaign, CampaignWriteRequest request) {
        requireNoEmptyPlaceholders(request.getSubjectTemplate(), "subject");
        requireNoEmptyPlaceholders(request.getBodyTemplate(), "body");
        campaign.setName(request.getName().trim());
        campaign.setSubjectTemplate(request.getSubjectTemplate().trim());
        campaign.setPreviewText(blankToNull(request.getPreviewText()));
        campaign.setBodyTemplate(request.getBodyTemplate());
        campaign.setFromEmail(defaultFromEmail);
        campaign.setFromName(blankToNull(request.getFromName()));
    }

    private CampaignResponse toResponse(Campaign campaign) {
        return new CampaignResponse(
                campaign.getId(),
                campaign.getName(),
                campaign.getSubjectTemplate(),
                campaign.getPreviewText(),
                campaign.getBodyTemplate(),
                campaign.getFromEmail(),
                campaign.getFromName(),
                campaign.getStatus(),
                campaign.getPausedReason(),
                campaign.getCreatedAt(),
                campaign.getUpdatedAt());
    }

    private CampaignSummaryResponse toSummary(Campaign campaign) {
        return new CampaignSummaryResponse(
                campaign.getId(),
                campaign.getName(),
                campaign.getSubjectTemplate(),
                campaign.getFromEmail(),
                campaign.getFromName(),
                campaign.getStatus(),
                campaign.getPausedReason(),
                campaign.getCreatedAt(),
                campaign.getUpdatedAt(),
                deliveryCounts(campaign.getId()));
    }

    private CampaignDetailResponse toDetail(Campaign campaign) {
        return new CampaignDetailResponse(
                campaign.getId(),
                campaign.getName(),
                campaign.getSubjectTemplate(),
                campaign.getPreviewText(),
                campaign.getBodyTemplate(),
                campaign.getFromEmail(),
                campaign.getFromName(),
                campaign.getStatus(),
                campaign.getPausedReason(),
                campaign.getCreatedAt(),
                campaign.getUpdatedAt(),
                deliveryCounts(campaign.getId()));
    }

    /**
     * Counts are read with JdbcTemplate so this slice does not need a delivery
     * entity yet. Every status is present (zero when absent) for stable clients.
     */
    private Map<String, Long> deliveryCounts(UUID campaignId) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (DeliveryStatus status : DeliveryStatus.values()) {
            counts.put(status.name(), 0L);
        }
        jdbcTemplate.query(
                "SELECT status, count(*) FROM notification_deliveries WHERE campaign_id = ? GROUP BY status",
                ps -> ps.setObject(1, campaignId),
                (RowCallbackHandler) rs -> counts.put(rs.getString(1), rs.getLong(2)));
        return counts;
    }

    /** K wake-up messages per campaign, capped so a huge list cannot flood the queue. */
    private void publishWakeUps(UUID campaignId, int count) {
        List<OutboxEvent> events = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            OutboxEvent event = new OutboxEvent();
            event.setAggregateId(campaignId);
            event.setTopic(RabbitConfig.CAMPAIGN_SEND_ROUTING_KEY);
            event.setPayload(Map.of("campaignId", campaignId.toString()));
            events.add(event);
        }
        outboxRepository.saveAll(events);
    }

    private static int wakeUpCount(long workItems) {
        int batches = (int) Math.ceil(workItems / 100.0);
        return Math.min(Math.max(1, batches), 5);
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
