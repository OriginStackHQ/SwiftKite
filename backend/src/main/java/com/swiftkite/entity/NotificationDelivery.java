package com.swiftkite.entity;

import com.swiftkite.enums.DeliveryStatus;
import com.swiftkite.enums.FailureCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Immutable execution record created at Send. Inputs (email, rendered subject
 * and body) are snapshots; only the status/provider fields change afterwards.
 */
@Entity
@Table(name = "notification_deliveries")
@Getter
@Setter
@NoArgsConstructor
public class NotificationDelivery {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, unique = true)
    private UUID id;

    @Column(name = "campaign_id", nullable = false, updatable = false)
    private UUID campaignId;

    @Column(name = "recipient_id", nullable = false, updatable = false)
    private UUID recipientId;

    @Column(nullable = false, columnDefinition = "text")
    private String email;

    @Column(name = "rendered_subject", nullable = false, columnDefinition = "text")
    private String renderedSubject;

    @Column(name = "rendered_body", nullable = false, columnDefinition = "text")
    private String renderedBody;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeliveryStatus status = DeliveryStatus.PENDING;

    @Column(name = "provider_message_id", columnDefinition = "text")
    private String providerMessageId;

    @Enumerated(EnumType.STRING)
    @Column(name = "failure_code", length = 30)
    private FailureCode failureCode;

    @Column(columnDefinition = "text")
    private String detail;

    @Column(name = "claimed_at")
    private OffsetDateTime claimedAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private OffsetDateTime updatedAt;
}
