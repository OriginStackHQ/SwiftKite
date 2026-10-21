package com.swiftkite.repository;

import com.swiftkite.entity.OAuthLoginCode;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OAuthLoginCodeRepository extends JpaRepository<OAuthLoginCode, UUID> {
    Optional<OAuthLoginCode> findByCodeHash(String codeHash);

    long deleteByExpiresAtBefore(OffsetDateTime cutoff);
}
