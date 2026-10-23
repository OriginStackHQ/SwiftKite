package com.swiftkite.services.implementation;

import com.swiftkite.repository.CampaignRepository;
import com.swiftkite.repository.NotificationDeliveryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Periodic safety net: reaps dead worker claims, completes finished campaigns,
 * and finalizes Stops after their last in-flight delivery resolves.
 *
 * <p>Unpublished outbox rows are re-published continuously by {@link OutboxRelay},
 * which never marks a row published until RabbitMQ confirms it.
 */
@Service
@Slf4j
public class CampaignReconciler {

    private final NotificationDeliveryRepository deliveryRepository;
    private final CampaignRepository campaignRepository;
    private final int stuckAfterMinutes;
    private final TransactionTemplate transactionTemplate;

    public CampaignReconciler(
            NotificationDeliveryRepository deliveryRepository,
            CampaignRepository campaignRepository,
            PlatformTransactionManager transactionManager,
            @Value("${app.reconciler.stuck-after-minutes}") int stuckAfterMinutes) {
        this.deliveryRepository = deliveryRepository;
        this.campaignRepository = campaignRepository;
        this.stuckAfterMinutes = stuckAfterMinutes;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(
            fixedDelayString = "${app.reconciler.delay-ms}",
            initialDelayString = "${app.reconciler.initial-delay-ms}")
    public void reconcile() {
        transactionTemplate.executeWithoutResult(status -> reconcileOnce());
    }

    private void reconcileOnce() {
        int reaped = deliveryRepository.failStaleAttempting(stuckAfterMinutes);
        if (reaped > 0) {
            log.warn("LockReaper marked {} stale delivery attempt(s) as OUTCOME_UNKNOWN", reaped);
        }

        int completed = campaignRepository.completeFinishedCampaigns();
        if (completed > 0) {
            log.info("Reconciler completed {} campaign(s)", completed);
        }

        int cancelled = deliveryRepository.cancelPendingForStoppingCampaigns();
        if (cancelled > 0) {
            log.info("Reconciler cancelled {} late PENDING deliveries for stopping campaigns", cancelled);
        }

        int stopped = campaignRepository.stopFinishedCampaigns();
        if (stopped > 0) {
            log.info("Reconciler finalized {} stopped campaign(s)", stopped);
        }
    }
}
