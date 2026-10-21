package com.swiftkite.entity;

import com.swiftkite.enums.EmailEventType;
import com.swiftkite.enums.Provider;
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
 * Append-only provider/delivery event history. Current recipient state lives on
 * {@link CampaignRecipient}; this table is the audit trail. Dedupe is enforced
 * on {@code (provider, provider_event_id)} when the event id is present.
 */
@Entity
@Table(name = "email_events")
@Getter
@Setter
@NoArgsConstructor
public class EmailEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, unique = true)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private Provider provider = Provider.FAKE;

    @Column(name = "provider_event_id", columnDefinition = "text")
    private String providerEventId;

    @Column(name = "publication_id", nullable = false, updatable = false)
    private UUID publicationId;

    @Column(name = "campaign_id", updatable = false)
    private UUID campaignId;

    @Column(name = "recipient_id", updatable = false)
    private UUID recipientId;

    /** Always set, including for confirmation-email events. */
    @Column(name = "subscriber_id", nullable = false, updatable = false)
    private UUID subscriberId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private EmailEventType type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String payload;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;

    @CreationTimestamp
    @Column(name = "received_at", nullable = false, updatable = false)
    private OffsetDateTime receivedAt;
}
