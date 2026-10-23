package com.swiftkite.repository;

import com.swiftkite.entity.Campaign;
import com.swiftkite.enums.CampaignStatus;
import com.swiftkite.enums.PausedReason;
import jakarta.persistence.LockModeType;
import java.util.Collection;
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
public interface CampaignRepository extends JpaRepository<Campaign, UUID> {

    Optional<Campaign> findByIdAndUserId(UUID id, UUID userId);

    /**
     * Serializes recipient edits with Send: Send updates this row, so a
     * concurrent add either happens before Send or observes SENDING and fails.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Campaign c where c.id = :id and c.userId = :userId")
    Optional<Campaign> findByIdAndUserIdForUpdate(
            @Param("id") UUID id, @Param("userId") UUID userId);

    /** Locks a campaign for execution-state changes (system pause, completion). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Campaign c where c.id = :id")
    Optional<Campaign> findByIdForUpdate(@Param("id") UUID id);

    Page<Campaign> findByUserId(UUID userId, Pageable pageable);

    /**
     * Content edits are only valid while DRAFT. The conditional UPDATE is the
     * guard: a concurrent Send that already moved the campaign to SENDING makes
     * this affect zero rows.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Campaign c
               set c.name = :name,
                   c.subjectTemplate = :subjectTemplate,
                   c.previewText = :previewText,
                   c.bodyTemplate = :bodyTemplate,
                   c.fromEmail = :fromEmail,
                   c.fromName = :fromName,
                   c.updatedAt = CURRENT_TIMESTAMP
             where c.id = :id
               and c.userId = :userId
               and c.status = :draft
            """)
    int updateDraft(
            @Param("id") UUID id,
            @Param("userId") UUID userId,
            @Param("draft") CampaignStatus draft,
            @Param("name") String name,
            @Param("subjectTemplate") String subjectTemplate,
            @Param("previewText") String previewText,
            @Param("bodyTemplate") String bodyTemplate,
            @Param("fromEmail") String fromEmail,
            @Param("fromName") String fromName);

    /**
     * Send guard: only DRAFT can become SENDING. The row lock taken by Send
     * makes this conditional update deterministic, but the check remains part
     * of the SQL as the final guard.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Campaign c
               set c.status = :sending,
                   c.updatedAt = CURRENT_TIMESTAMP
             where c.id = :id
               and c.userId = :userId
               and c.status = :draft
            """)
    int markSending(
            @Param("id") UUID id,
            @Param("userId") UUID userId,
            @Param("draft") CampaignStatus draft,
            @Param("sending") CampaignStatus sending);

    /** User pause: only SENDING campaigns can become PAUSED. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Campaign c
               set c.status = :paused,
                   c.pausedReason = :reason,
                   c.updatedAt = CURRENT_TIMESTAMP
             where c.id = :id
               and c.userId = :userId
               and c.status = :sending
            """)
    int pause(
            @Param("id") UUID id,
            @Param("userId") UUID userId,
            @Param("sending") CampaignStatus sending,
            @Param("paused") CampaignStatus paused,
            @Param("reason") PausedReason reason);

    /** Resume clears the pause reason; workers are re-woken by new outbox rows. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Campaign c
               set c.status = :sending,
                   c.pausedReason = null,
                   c.updatedAt = CURRENT_TIMESTAMP
             where c.id = :id
               and c.userId = :userId
               and c.status = :paused
            """)
    int resume(
            @Param("id") UUID id,
            @Param("userId") UUID userId,
            @Param("paused") CampaignStatus paused,
            @Param("sending") CampaignStatus sending);

    /** Stop is allowed from SENDING or PAUSED; in-flight work finishes. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Campaign c
               set c.status = :stopping,
                   c.pausedReason = null,
                   c.updatedAt = CURRENT_TIMESTAMP
             where c.id = :id
               and c.userId = :userId
               and c.status in :allowedStatuses
            """)
    int markStopping(
            @Param("id") UUID id,
            @Param("userId") UUID userId,
            @Param("allowedStatuses") Collection<CampaignStatus> allowedStatuses,
            @Param("stopping") CampaignStatus stopping);

    /**
     * Hard delete is only valid for terminal/idle states. The status filter is
     * part of the DELETE so a concurrent state change cannot be missed.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            delete from Campaign c
             where c.id = :id
               and c.userId = :userId
               and c.status in :allowedStatuses
            """)
    int deleteByIdAndUserIdAndStatusIn(
            @Param("id") UUID id,
            @Param("userId") UUID userId,
            @Param("allowedStatuses") Collection<CampaignStatus> allowedStatuses);

    /**
     * Completion is only valid for SENDING campaigns with no work left. The
     * NOT EXISTS check is part of the UPDATE so a concurrent claim cannot be
     * missed.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE campaigns
               SET status = 'COMPLETED',
                   updated_at = now()
             WHERE id = :id
               AND status = 'SENDING'
               AND NOT EXISTS (
                   SELECT 1
                     FROM notification_deliveries d
                    WHERE d.campaign_id = :id
                      AND d.status IN ('PENDING', 'ATTEMPTING')
               )
            """, nativeQuery = true)
    int markCompletedIfDone(@Param("id") UUID id);

    /** Reconciler safety net for all SENDING campaigns that have no work left. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE campaigns c
               SET status = 'COMPLETED',
                   updated_at = now()
             WHERE c.status = 'SENDING'
               AND NOT EXISTS (
                   SELECT 1
                     FROM notification_deliveries d
                    WHERE d.campaign_id = c.id
                      AND d.status IN ('PENDING', 'ATTEMPTING')
               )
            """, nativeQuery = true)
    int completeFinishedCampaigns();

    /**
     * Finish a Stop as soon as the last in-flight delivery is resolved. PENDING
     * rows are cancelled by the reconciler before this runs.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE campaigns c
               SET status = 'STOPPED',
                   paused_reason = NULL,
                   updated_at = now()
             WHERE c.id = :id
               AND c.status = 'STOPPING'
               AND NOT EXISTS (
                   SELECT 1
                     FROM notification_deliveries d
                    WHERE d.campaign_id = c.id
                      AND d.status IN ('PENDING', 'ATTEMPTING')
               )
            """, nativeQuery = true)
    int markStoppedIfNoWorkLeft(@Param("id") UUID id);

    /** Reconciler safety net for all STOPPING campaigns with no in-flight work. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE campaigns c
               SET status = 'STOPPED',
                   paused_reason = NULL,
                   updated_at = now()
             WHERE c.status = 'STOPPING'
               AND NOT EXISTS (
                   SELECT 1
                     FROM notification_deliveries d
                    WHERE d.campaign_id = c.id
                      AND d.status IN ('PENDING', 'ATTEMPTING')
               )
            """, nativeQuery = true)
    int stopFinishedCampaigns();
}
