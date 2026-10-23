package com.swiftkite.repository;

import com.swiftkite.entity.OutboxEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    /**
     * Locks a batch of unpublished rows while the relay publishes them. SKIP
     * LOCKED lets multiple relay instances run without colliding.
     */
    @Query(value = """
            SELECT *
              FROM outbox_events
             WHERE published_at IS NULL
             ORDER BY created_at
             LIMIT :limit
             FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    List<OutboxEvent> findUnpublishedForUpdate(@Param("limit") int limit);

    /** A deleted campaign must not leave a stale wake-up waiting to publish. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from OutboxEvent e where e.aggregateId = :aggregateId and e.publishedAt is null")
    int deleteUnpublishedByAggregateId(@Param("aggregateId") UUID aggregateId);
}
