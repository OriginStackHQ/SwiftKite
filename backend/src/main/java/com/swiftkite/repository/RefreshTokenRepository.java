package com.swiftkite.repository;

import com.swiftkite.entity.RefreshToken;
import com.swiftkite.entity.ApplicationUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByUser(ApplicationUser user);

    Optional<RefreshToken> findByTokenHash(String tokenHash);
}
