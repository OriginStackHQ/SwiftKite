package com.swiftkite.entity;

import com.swiftkite.enums.Provider;
import com.swiftkite.enums.WebhookInboxStatus;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Durable staging for provider webhooks: verify the signature, insert here,
 * return 2xx, and process later. Dedupe is enforced by the database on
 * {@code (provider, provider_event_id)} where the event id is present.
 */
@Entity
@Table(name = "webhook_inbox")
@Getter
@Setter
@NoArgsConstructor
public class WebhookInbox {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, unique = true)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private Provider provider;

    @Column(name = "provider_event_id", columnDefinition = "text")
    private String providerEventId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private WebhookInboxStatus status = WebhookInboxStatus.RECEIVED;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "next_attempt_at")
    private OffsetDateTime nextAttemptAt;

    @Column(columnDefinition = "text")
    private String error;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    private OffsetDateTime receivedAt;

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;
}
