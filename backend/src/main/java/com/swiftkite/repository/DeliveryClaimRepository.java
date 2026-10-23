package com.swiftkite.repository;

import com.swiftkite.dto.delivery.ClaimedDelivery;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Claims one PENDING delivery for a campaign. The campaign status check lives
 * inside the SQL so a pause/stop races only a very small window. The returned
 * row is committed before the caller invokes the email provider.
 */
@Repository
public class DeliveryClaimRepository {

    private static final String CLAIM_SQL = """
            UPDATE notification_deliveries d
               SET status = 'ATTEMPTING',
                   claimed_at = now(),
                   updated_at = now()
              FROM campaigns c
             WHERE c.id = d.campaign_id
               AND d.id = (
                   SELECT candidate.id
                     FROM notification_deliveries candidate
                     JOIN campaigns sending ON sending.id = candidate.campaign_id
                    WHERE candidate.campaign_id = ?
                      AND candidate.status = 'PENDING'
                      AND sending.status = 'SENDING'
                    ORDER BY candidate.id
                    LIMIT 1
                    FOR UPDATE OF candidate SKIP LOCKED
             )
            RETURNING d.id,
                      d.campaign_id,
                      d.email,
                      d.rendered_subject,
                      d.rendered_body,
                      c.from_email,
                      c.from_name
            """;

    private static final RowMapper<ClaimedDelivery> ROW_MAPPER = (rs, rowNum) -> new ClaimedDelivery(
            rs.getObject("id", UUID.class),
            rs.getObject("campaign_id", UUID.class),
            rs.getString("email"),
            rs.getString("rendered_subject"),
            rs.getString("rendered_body"),
            rs.getString("from_email"),
            rs.getString("from_name"));

    private final JdbcTemplate jdbcTemplate;

    public DeliveryClaimRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public Optional<ClaimedDelivery> claim(UUID campaignId) {
        List<ClaimedDelivery> rows = jdbcTemplate.query(CLAIM_SQL, ROW_MAPPER, campaignId);
        return rows.stream().findFirst();
    }
}
