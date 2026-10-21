package com.swiftkite.entity;

import com.swiftkite.enums.SubscriberStatus;
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
 * A subscriber of one publication. Deletion is soft ({@code deletedAt});
 * the lifecycle status is preserved so suppression/history stays meaningful.
 * The confirmation token is HMAC-signed and never stored; only the random
 * nonce used to build it is kept here.
 */
@Entity
@Table(
        name = "subscribers",
        uniqueConstraints =
                @UniqueConstraint(name = "uq_subscribers_publication_email", columnNames = {"publication_id", "email"}))
@Getter
@Setter
@NoArgsConstructor
public class Subscriber {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, unique = true)
    private UUID id;

    @Column(name = "publication_id", nullable = false, updatable = false)
    private UUID publicationId;

    @Column(nullable = false, columnDefinition = "citext")
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private SubscriberStatus status = SubscriberStatus.PENDING;

    @Column(name = "consent_at")
    private OffsetDateTime consentAt;

    @Column(name = "consent_ip", columnDefinition = "text")
    private String consentIp;

    /** Null when no confirmation is pending. */
    @Column(name = "confirm_nonce", columnDefinition = "text")
    private String confirmNonce;

    @Column(name = "confirm_token_expires_at")
    private OffsetDateTime confirmTokenExpiresAt;

    @Column(name = "confirmation_sent_at")
    private OffsetDateTime confirmationSentAt;

    @Column(name = "confirmed_at")
    private OffsetDateTime confirmedAt;

    @Column(name = "unsubscribed_at")
    private OffsetDateTime unsubscribedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
