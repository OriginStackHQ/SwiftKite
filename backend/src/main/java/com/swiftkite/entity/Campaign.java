package com.swiftkite.entity;

import com.swiftkite.enums.CampaignStatus;
import com.swiftkite.enums.PausedReason;
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
 * A campaign is the user's intent: templates plus sender information. Execution
 * rows are created only when the campaign is sent, and live in
 * {@code notification_deliveries}.
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

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(nullable = false, columnDefinition = "text")
    private String name;

    @Column(name = "subject_template", nullable = false, columnDefinition = "text")
    private String subjectTemplate;

    @Column(name = "preview_text", columnDefinition = "text")
    private String previewText;

    @Column(name = "body_template", nullable = false, columnDefinition = "text")
    private String bodyTemplate;

    @Column(name = "from_email", nullable = false, columnDefinition = "text")
    private String fromEmail;

    @Column(name = "from_name", columnDefinition = "text")
    private String fromName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CampaignStatus status = CampaignStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "paused_reason", length = 20)
    private PausedReason pausedReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    @UpdateTimestamp
    private OffsetDateTime updatedAt;
}
