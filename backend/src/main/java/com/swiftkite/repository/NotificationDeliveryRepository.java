package com.swiftkite.repository;

import com.swiftkite.entity.NotificationDelivery;
import com.swiftkite.enums.DeliveryStatus;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, UUID> {

    long countByCampaignId(UUID campaignId);

    long countByCampaignIdAndStatus(UUID campaignId, DeliveryStatus status);

    Page<NotificationDelivery> findByCampaignId(UUID campaignId, Pageable pageable);

    Page<NotificationDelivery> findByCampaignIdAndStatus(
            UUID campaignId, DeliveryStatus status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from NotificationDelivery d where d.providerMessageId = :providerMessageId")
    Optional<NotificationDelivery> findByProviderMessageIdForUpdate(
            @Param("providerMessageId") String providerMessageId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from NotificationDelivery d where d.id = :id")
    Optional<NotificationDelivery> findByIdForUpdate(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE notification_deliveries
               SET status = 'ACCEPTED',
                   provider_message_id = :providerMessageId,
                   accepted_at = now(),
                   failure_code = NULL,
                   detail = NULL,
                   updated_at = now()
             WHERE id = :id
               AND status = 'ATTEMPTING'
            """, nativeQuery = true)
    int markAccepted(
            @Param("id") UUID id, @Param("providerMessageId") String providerMessageId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE notification_deliveries
               SET status = 'FAILED',
                   failure_code = 'PROVIDER_REJECTED',
                   detail = :detail,
                   provider_message_id = NULL,
                   accepted_at = NULL,
                   updated_at = now()
             WHERE id = :id
               AND status = 'ATTEMPTING'
            """, nativeQuery = true)
    int markRejected(@Param("id") UUID id, @Param("detail") String detail);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE notification_deliveries
               SET status = 'FAILED',
                   failure_code = 'OUTCOME_UNKNOWN',
                   detail = :detail,
                   provider_message_id = NULL,
                   accepted_at = NULL,
                   updated_at = now()
             WHERE id = :id
               AND status = 'ATTEMPTING'
            """, nativeQuery = true)
    int markUnknownOutcome(@Param("id") UUID id, @Param("detail") String detail);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE notification_deliveries
               SET status = 'PENDING',
                   claimed_at = NULL,
                   updated_at = now()
             WHERE id = :id
               AND status = 'ATTEMPTING'
            """, nativeQuery = true)
    int returnToPending(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE notification_deliveries
               SET status = 'CANCELLED',
                   claimed_at = NULL,
                   updated_at = now()
             WHERE id = :id
               AND status = 'ATTEMPTING'
            """, nativeQuery = true)
    int cancelAttempting(@Param("id") UUID id);

    /** Stop: unsent work becomes CANCELLED, not PENDING. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE notification_deliveries
               SET status = 'CANCELLED',
                   claimed_at = NULL,
                   updated_at = now()
             WHERE campaign_id = :campaignId
               AND status = 'PENDING'
            """, nativeQuery = true)
    int cancelPendingByCampaignId(@Param("campaignId") UUID campaignId);

    /** Reconciler: catch PENDING rows that appeared during a Stop. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE notification_deliveries d
               SET status = 'CANCELLED',
                   claimed_at = NULL,
                   updated_at = now()
             WHERE d.status = 'PENDING'
               AND EXISTS (
                   SELECT 1
                     FROM campaigns c
                    WHERE c.id = d.campaign_id
                      AND c.status = 'STOPPING'
               )
            """, nativeQuery = true)
    int cancelPendingForStoppingCampaigns();

    /**
     * LockReaper: an ATTEMPTING row older than the threshold belongs to a dead
     * or timed-out worker. It is never retried because the provider may have
     * accepted the message.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE notification_deliveries
               SET status = 'FAILED',
                   failure_code = 'OUTCOME_UNKNOWN',
                   detail = 'worker died or timed out mid-send',
                   updated_at = now()
             WHERE status = 'ATTEMPTING'
               AND claimed_at IS NOT NULL
               AND claimed_at < now() - make_interval(mins => :minutes)
            """, nativeQuery = true)
    int failStaleAttempting(@Param("minutes") int minutes);
}
