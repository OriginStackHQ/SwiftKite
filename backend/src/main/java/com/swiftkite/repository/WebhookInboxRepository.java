package com.swiftkite.repository;

import com.swiftkite.enums.InboxStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Optional;
import java.util.UUID;
import org.hibernate.Session;
import org.springframework.stereotype.Repository;

/**
 * Webhook inbox access. The insert is the dedup gate: the unique
 * (provider, provider_event_id) constraint plus ON CONFLICT makes retries safe.
 * Both operations use the caller's JPA transaction connection so the inbox row
 * and the delivery repair commit or roll back together.
 */
@Repository
public class WebhookInboxRepository {

    @PersistenceContext
    private EntityManager entityManager;

    /** Returns the new inbox id, or empty when this event was already received. */
    public Optional<UUID> tryInsert(String provider, String providerEventId, String payloadJson) {
        UUID id = entityManager.unwrap(Session.class).doReturningWork(connection -> {
            try (PreparedStatement statement = connection.prepareStatement(
                    """
                    INSERT INTO inbox_events (provider, provider_event_id, payload, status)
                    VALUES (?, ?, ?::jsonb, 'RECEIVED')
                    ON CONFLICT (provider, provider_event_id) DO NOTHING
                    RETURNING id
                    """)) {
                statement.setString(1, provider);
                statement.setString(2, providerEventId);
                statement.setString(3, payloadJson);
                try (ResultSet rs = statement.executeQuery()) {
                    return rs.next() ? rs.getObject("id", UUID.class) : null;
                }
            }
        });
        return Optional.ofNullable(id);
    }

    public void markStatus(UUID inboxId, InboxStatus status) {
        entityManager
                .createNativeQuery(
                        "UPDATE inbox_events SET status = ?, processed_at = now() WHERE id = ?")
                .setParameter(1, status.name())
                .setParameter(2, inboxId)
                .executeUpdate();
    }
}
