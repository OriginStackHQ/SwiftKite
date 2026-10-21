package com.swiftkite.entity;

import com.swiftkite.enums.FailureCode;
import com.swiftkite.enums.RecipientStatus;
import com.swiftkite.enums.SkipReason;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Campaign x subscriber delivery state. High-volume table: FKs are plain UUID
 * columns (no associations) because the worker claims rows with conditional
 * bulk updates. {@code UNIQUE (campaign_id, subscriber_id)} is the snapshot
 * idempotency guarantee.
 */
@Entity
@Table(
        name = "campaign_recipients",
        uniqueConstraints =
                @UniqueConstraint(name = "uq_recipients_campaign_subscriber", columnNames = {"campaign_id", "subscriber_id"}))
@Getter
@Setter
@NoArgsConstructor
public class CampaignRecipient {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, unique = true)
    private UUID id;

    @Column(name = "campaign_id", nullable = false, updatable = false)
    private UUID campaignId;

    /** Never null: subscribers are soft-deleted, so rows are never orphaned. */
    @Column(name = "subscriber_id", nullable = false, updatable = false)
    private UUID subscriberId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private RecipientStatus status = RecipientStatus.QUEUED;

    @Enumerated(EnumType.STRING)
    @Column(name = "skip_reason", columnDefinition = "text")
    private SkipReason skipReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "failure_code", columnDefinition = "text")
    private FailureCode failureCode;

    @Column(name = "batch_no", nullable = false)
    private int batchNo;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "next_attempt_at")
    private OffsetDateTime nextAttemptAt;

    @Column(name = "claimed_at")
    private OffsetDateTime claimedAt;

    @Column(name = "provider_message_id", columnDefinition = "text")
    private String providerMessageId;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
