package com.swiftkite.repository;

import com.swiftkite.entity.CampaignRecipient;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CampaignRecipientRepository extends JpaRepository<CampaignRecipient, UUID> {

    Page<CampaignRecipient> findByCampaignId(UUID campaignId, Pageable pageable);

    Optional<CampaignRecipient> findByCampaignIdAndEmail(UUID campaignId, String email);

    List<CampaignRecipient> findByCampaignIdOrderById(UUID campaignId);

    long countByCampaignId(UUID campaignId);

    @Query("""
            select r.email
              from CampaignRecipient r
             where r.campaignId = :campaignId
               and r.email in :emails
            """)
    List<String> findExistingEmails(
            @Param("campaignId") UUID campaignId, @Param("emails") Collection<String> emails);

    /**
     * Rename a JSONB field for every recipient that has it: the value moves to the
     * new key and the old key is dropped. Non-overwriting by default so a recipient
     * that already has the new key keeps its value.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE campaign_recipients
               SET data = (data - :from) || jsonb_build_object(:to, data -> :from)
             WHERE campaign_id = :campaignId
               AND jsonb_exists(data, :from)
               AND (CAST(:overwrite AS boolean) = true OR NOT jsonb_exists(data, :to))
            """, nativeQuery = true)
    int renameField(
            @Param("campaignId") UUID campaignId,
            @Param("from") String from,
            @Param("to") String to,
            @Param("overwrite") boolean overwrite);

    /** Remove a JSONB field from every recipient that has it. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE campaign_recipients
               SET data = data - :key
             WHERE campaign_id = :campaignId
               AND jsonb_exists(data, :key)
            """, nativeQuery = true)
    int removeField(@Param("campaignId") UUID campaignId, @Param("key") String key);
}
