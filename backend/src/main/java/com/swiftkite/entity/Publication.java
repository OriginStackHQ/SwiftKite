package com.swiftkite.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * A newsletter owned by one creator. Publications are never soft-deleted:
 * deletion is a hard delete guarded by campaign state (see PROJECT.md).
 */
@Entity
@Table(name = "publications")
@Getter
@Setter
@NoArgsConstructor
public class Publication {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false, unique = true)
    private UUID id;

    /** Public, non-secret identifier used by embed forms and public pages. */
    @Column(name = "public_id", nullable = false, unique = true, length = 40)
    private String publicId;

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(nullable = false, columnDefinition = "text")
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "from_name", nullable = false, columnDefinition = "text")
    private String fromName;

    @Column(name = "from_email", nullable = false, columnDefinition = "citext")
    private String fromEmail;

    @Column(name = "reply_to", columnDefinition = "citext")
    private String replyTo;

    /**
     * Set by a successful real test send with the current sender; reset to null
     * when {@code fromName}, {@code fromEmail} or {@code replyTo} changes.
     */
    @Column(name = "sender_tested_at")
    private OffsetDateTime senderTestedAt;

    @Column(name = "confirmation_subject", nullable = false, columnDefinition = "text")
    private String confirmationSubject;

    @Column(name = "confirmation_preview_text", columnDefinition = "text")
    private String confirmationPreviewText;

    @Column(name = "welcome_redirect_url", columnDefinition = "text")
    private String welcomeRedirectUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
