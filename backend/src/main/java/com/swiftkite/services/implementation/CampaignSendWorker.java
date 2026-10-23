package com.swiftkite.services.implementation;

import com.swiftkite.dto.delivery.ClaimedDelivery;
import com.swiftkite.provider.EmailMessage;
import com.swiftkite.provider.EmailProvider;
import com.swiftkite.provider.SendResult;
import com.swiftkite.repository.DeliveryClaimRepository;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Claims and sends deliveries for one campaign wake-up message. */
@Service
@Slf4j
public class CampaignSendWorker {

    private final DeliveryClaimRepository claimRepository;
    private final DeliveryOutcomeService outcomeService;
    private final EmailProvider emailProvider;

    public CampaignSendWorker(
            DeliveryClaimRepository claimRepository,
            DeliveryOutcomeService outcomeService,
            EmailProvider emailProvider) {
        this.claimRepository = claimRepository;
        this.outcomeService = outcomeService;
        this.emailProvider = emailProvider;
    }

    public void run(UUID campaignId) {
        while (true) {
            Optional<ClaimedDelivery> claimed = claimRepository.claim(campaignId);
            if (claimed.isEmpty()) {
                break;
            }

            ClaimedDelivery delivery = claimed.get();
            SendResult result = send(delivery);
            boolean keepGoing = outcomeService.record(campaignId, delivery.getId(), result);
            if (!keepGoing) {
                break;
            }
        }

        outcomeService.completeIfDone(campaignId);
    }

    /** Provider calls are deliberately outside every database transaction. */
    private SendResult send(ClaimedDelivery delivery) {
        try {
            EmailMessage message = new EmailMessage(
                    delivery.getFromName(),
                    delivery.getFromEmail(),
                    null,
                    delivery.getEmail(),
                    delivery.getRenderedSubject(),
                    delivery.getRenderedBody(),
                    null,
                    delivery.getId().toString());

            SendResult result = emailProvider.send(message);
            if (result == null) {
                return new SendResult.Unknown("Provider returned no result; outcome unknown.");
            }
            return result;
        } catch (RuntimeException ex) {
            log.error("Provider call failed for delivery {}", delivery.getId(), ex);
            String detail = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            return new SendResult.Unknown("Provider call failed; outcome unknown: " + detail);
        }
    }
}
