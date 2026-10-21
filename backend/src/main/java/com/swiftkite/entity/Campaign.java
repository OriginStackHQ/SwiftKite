package com.swiftkite.entity;

import com.swiftkite.enums.CampaignStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A campaign draft/issue. Content is frozen when sending starts; after that
 * the campaign is history and is duplicated rather than edited.
 */
@Entity
@Table(name = "campaigns")
@Getter
@Setter
@NoArgsConstructor
public class Campaign {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, unique = true)
    private UUID id;

    @Column(name = "publication_id", nullable = false, updatable = false)
    private UUID publicationId;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @Column(name = "duplicated_from_id", updatable = false)
    private UUID duplicatedFromId;

    @Column(nullable = false, columnDefinition = "text")
    private String title = "Untitled campaign";

    @Column(nullable = false, columnDefinition = "text")
    private String subject = "";

    @Column(name = "preview_text", columnDefinition = "text")
    private String previewText;

    /** Editor document (ProseMirror-style JSON) as stored JSONB. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "content_json", columnDefinition = "jsonb")
    private String contentJson;

    @Column(name = "content_html", columnDefinition = "text")
    private String contentHtml;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private CampaignStatus status = CampaignStatus.DRAFT;

    @Column(name = "scheduled_at")
    private OffsetDateTime scheduledAt;

    @Column(name = "scheduled_timezone", columnDefinition = "text")
    private String scheduledTimezone;

    @Column(name = "from_name", columnDefinition = "text")
    private String fromName;

    @Column(name = "from_email", columnDefinition = "citext")
    private String fromEmail;

    @Column(name = "reply_to", columnDefinition = "citext")
    private String replyTo;

    @Column(name = "audience_count")
    private Integer audienceCount;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    /** Systemic-error backoff; workers do nothing for this campaign until it passes. */
    @Column(name = "send_not_before")
    private OffsetDateTime sendNotBefore;

    @Version
    @Column(nullable = false)
    private int version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
