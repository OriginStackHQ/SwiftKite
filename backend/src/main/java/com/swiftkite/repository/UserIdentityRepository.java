package com.swiftkite.repository;

import com.swiftkite.entity.UserIdentity;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.enums.AuthProvider;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {
    Optional<UserIdentity> findByProviderAndProviderId(AuthProvider provider, String providerId);

    boolean existsByUserAndProvider(ApplicationUser user, AuthProvider provider);

    List<UserIdentity> findByUser(ApplicationUser user);
}
