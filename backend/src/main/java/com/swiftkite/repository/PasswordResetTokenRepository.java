package com.swiftkite.repository;

import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.entity.PasswordResetToken;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    Optional<PasswordResetToken> findByUser(ApplicationUser user);

    long deleteByExpiresAtBefore(OffsetDateTime cutoff);
}
