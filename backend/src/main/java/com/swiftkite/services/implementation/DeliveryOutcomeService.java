package com.swiftkite.services.implementation;

import com.swiftkite.entity.Campaign;
import com.swiftkite.enums.CampaignStatus;
import com.swiftkite.enums.PausedReason;
import com.swiftkite.provider.SendResult;
import com.swiftkite.repository.CampaignRepository;
import com.swiftkite.repository.NotificationDeliveryRepository;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies one provider outcome and the campaign-level reaction to it. */
@Service
@Slf4j
public class DeliveryOutcomeService {

    private static final int MAX_DETAIL_LENGTH = 2_000;

    private final NotificationDeliveryRepository deliveryRepository;
    private final CampaignRepository campaignRepository;

    public DeliveryOutcomeService(
            NotificationDeliveryRepository deliveryRepository,
            CampaignRepository campaignRepository) {
        this.deliveryRepository = deliveryRepository;
        this.campaignRepository = campaignRepository;
    }

    /**
     * Returns true when the worker should continue claiming deliveries. System
     * pauses return false because the campaign is no longer SENDING.
     */
    @Transactional
    public boolean record(UUID campaignId, UUID deliveryId, SendResult result) {
        return switch (result) {
            case SendResult.Accepted accepted -> {
                int updated = deliveryRepository.markAccepted(
                        deliveryId, accepted.providerMessageId());
                logIfMissed(updated, deliveryId, "ACCEPTED");
                yield true;
            }
            case SendResult.Rejected rejected -> {
                int updated = deliveryRepository.markRejected(
                        deliveryId, summarize(rejected.detail()));
                logIfMissed(updated, deliveryId, "FAILED / PROVIDER_REJECTED");
                yield true;
            }
            case SendResult.Unknown unknown -> {
                int updated = deliveryRepository.markUnknownOutcome(
                        deliveryId, summarize(unknown.detail()));
                logIfMissed(updated, deliveryId, "FAILED / OUTCOME_UNKNOWN");
                yield true;
            }
            case SendResult.AuthError _ -> {
                pauseForSystemFailure(campaignId, deliveryId, PausedReason.PROVIDER);
                yield false;
            }
            case SendResult.RateLimited _ -> {
                pauseForSystemFailure(campaignId, deliveryId, PausedReason.RATE_LIMITED);
                yield false;
            }
        };
    }

    @Transactional
    public boolean completeIfDone(UUID campaignId) {
        return campaignRepository.markCompletedIfDone(campaignId) > 0;
    }

    private void pauseForSystemFailure(UUID campaignId, UUID deliveryId, PausedReason reason) {
        Campaign campaign = campaignRepository.findByIdForUpdate(campaignId).orElse(null);
        boolean terminalRace = false;

        if (campaign != null) {
            if (campaign.getStatus() == CampaignStatus.SENDING) {
                campaign.setStatus(CampaignStatus.PAUSED);
                campaign.setPausedReason(reason);
                campaignRepository.save(campaign);
                log.warn("Campaign {} paused due to provider outcome {}", campaignId, reason);
            } else if (campaign.getStatus() != CampaignStatus.PAUSED) {
                // A Stop (or another terminal transition) won the race.
                terminalRace = true;
            }
        }

        // A terminal campaign must not leave the delivery PENDING behind it.
        // Otherwise it stays pending for a later Resume.
        if (terminalRace) {
            deliveryRepository.cancelAttempting(deliveryId);
        } else {
            deliveryRepository.returnToPending(deliveryId);
        }
    }

    private static void logIfMissed(int updated, UUID deliveryId, String target) {
        if (updated == 0) {
            log.warn(
                    "Delivery {} was not moved to {}; it may have been reaped or already handled.",
                    deliveryId,
                    target);
        }
    }

    private static String summarize(String detail) {
        if (detail == null) {
            return null;
        }
        String trimmed = detail.strip();
        return trimmed.length() <= MAX_DETAIL_LENGTH
                ? trimmed
                : trimmed.substring(0, MAX_DETAIL_LENGTH) + "...";
    }
}
