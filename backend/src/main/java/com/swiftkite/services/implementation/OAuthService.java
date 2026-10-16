package com.swiftkite.services.implementation;

import com.swiftkite.dto.auth.LinkTokenResponse;
import com.swiftkite.dto.auth.OAuthExchangeRequest;
import com.swiftkite.dto.auth.ProvidersResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.entity.OAuthLoginCode;
import com.swiftkite.entity.RefreshToken;
import com.swiftkite.entity.Role;
import com.swiftkite.entity.UserIdentity;
import com.swiftkite.enums.AuthProvider;
import com.swiftkite.enums.RoleName;
import com.swiftkite.exception.AppException;
import com.swiftkite.exception.InvalidTokenException;
import com.swiftkite.exception.NotFoundException;
import com.swiftkite.repository.ApplicationUserRepository;
import com.swiftkite.repository.OAuthLoginCodeRepository;
import com.swiftkite.repository.RefreshTokenRepository;
import com.swiftkite.repository.RoleRepository;
import com.swiftkite.repository.UserIdentityRepository;
import com.swiftkite.services.implementation.AuthService.TokenPair;
import com.swiftkite.services.interfaces.IOAuthService;
import com.swiftkite.util.TokenHashes;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@Transactional
public class OAuthService implements IOAuthService {
    private final ApplicationUserRepository applicationUserRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserIdentityRepository userIdentityRepository;
    private final OAuthLoginCodeRepository codeRepository;
    private final JwtService jwtService;

    public OAuthService(
            ApplicationUserRepository applicationUserRepository,
            RoleRepository roleRepository,
            RefreshTokenRepository refreshTokenRepository,
            UserIdentityRepository userIdentityRepository,
            OAuthLoginCodeRepository codeRepository,
            JwtService jwtService) {
        this.applicationUserRepository = applicationUserRepository;
        this.roleRepository = roleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userIdentityRepository = userIdentityRepository;
        this.codeRepository = codeRepository;
        this.jwtService = jwtService;
    }

    @Override
    public TokenPair exchangeCode(@Valid OAuthExchangeRequest request) {
        OAuthLoginCode code = codeRepository
                .findByCodeHash(TokenHashes.sha256Hex(request.getCode()))
                .orElseThrow(() -> new InvalidTokenException("Invalid or expired login code."));
        // Single-use: consumed on read, cannot be replayed.
        codeRepository.delete(code);

        if (code.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new InvalidTokenException("Login code has expired. Please try again.");
        }

        ApplicationUser user;
        if (code.getUser() != null) {
            user = code.getUser();
        } else if (request.getLinkToken() != null && !request.getLinkToken().isBlank()) {
            user = linkToCurrentAccount(code, request.getLinkToken());
        } else {
            user = loginOrAutoCreate(code);
        }
        return issueFreshSession(user);
    }

    @Override
    public LinkTokenResponse issueLinkToken(String email) {
        ApplicationUser user = requireUser(email);
        return new LinkTokenResponse(jwtService.generateLinkToken(user));
    }

    @Override
    @Transactional(readOnly = true)
    public ProvidersResponse providers(String email) {
        ApplicationUser user = requireUser(email);
        List<ProvidersResponse.LinkedProvider> linked = userIdentityRepository.findByUser(user).stream()
                .map(identity -> new ProvidersResponse.LinkedProvider(
                        identity.getProvider().name(), identity.getCreatedAt()))
                .toList();
        return new ProvidersResponse(user.getPassword() != null, linked);
    }

    @Override
    public void unlinkProvider(String email, AuthProvider provider) {
        if (provider == AuthProvider.LOCAL) {
            throw new AppException(
                    "Password sign-in cannot be unlinked here. Set a new password first.",
                    HttpStatus.BAD_REQUEST);
        }
        ApplicationUser user = requireUser(email);
        List<UserIdentity> identities = userIdentityRepository.findByUser(user);
        UserIdentity identity = identities.stream()
                .filter(candidate -> candidate.getProvider() == provider)
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Google account is not linked."));

        // Last-credential guard: an account must keep at least one way to sign in.
        if (user.getPassword() == null && identities.size() <= 1) {
            throw new AppException(
                    "Cannot unlink the only sign-in method. Set a password first.", HttpStatus.CONFLICT);
        }
        userIdentityRepository.delete(identity);
    }

    /**
     Binds a fresh Google identity to the account the link token was issued
     for. Fails closed when the Google account already belongs to someone else.
    */
    private ApplicationUser linkToCurrentAccount(OAuthLoginCode code, String linkToken) {
        String email;
        try {
            if (!jwtService.isLinkToken(linkToken)) {
                throw new InvalidTokenException("Invalid link token.");
            }
            email = jwtService.extractEmail(linkToken);
        } catch (InvalidTokenException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidTokenException("Invalid or expired link token.");
        }
        ApplicationUser user = requireUser(email);

        Optional<UserIdentity> taken = userIdentityRepository.findByProviderAndProviderId(
                code.getProvider(), code.getProviderId());
        if (taken.isPresent() && !taken.get().getUser().getId().equals(user.getId())) {
            throw new AppException(
                    "This Google account is already linked to a different account.", HttpStatus.CONFLICT);
        }
        if (taken.isEmpty()) {
            linkIdentity(user, code.getProvider(), code.getProviderId());
        }
        return user;
    }

    /** Known email -> link Google to that account; otherwise auto-create (Google always supplies email). */
    private ApplicationUser loginOrAutoCreate(OAuthLoginCode code) {
        if (code.getEmail() != null) {
            Optional<ApplicationUser> existing =
                    applicationUserRepository.findByEmail(code.getEmail().toLowerCase());
            if (existing.isPresent()) {
                linkIdentity(existing.get(), code.getProvider(), code.getProviderId());
                return existing.get();
            }
        }
        ApplicationUser user = new ApplicationUser();
        user.setEmail(code.getEmail() != null ? code.getEmail().toLowerCase() : code.getProviderId() + "@google.local");
        user.setFirstName(orUnknown(code.getFirstName()));
        user.setLastName(orUnknown(code.getLastName()));
        Role creatorRole = roleRepository
                .findByName(RoleName.CREATOR)
                .orElseThrow(() -> new NotFoundException("Creator role not found."));
        user.setRoles(List.of(creatorRole));
        ApplicationUser saved = applicationUserRepository.save(user);
        linkIdentity(saved, code.getProvider(), code.getProviderId());
        return saved;
    }

    private void linkIdentity(ApplicationUser user, AuthProvider provider, String providerId) {
        if (!userIdentityRepository.existsByUserAndProvider(user, provider)) {
            UserIdentity identity = new UserIdentity();
            identity.setUser(user);
            identity.setProvider(provider);
            identity.setProviderId(providerId);
            userIdentityRepository.save(identity);
        }
    }

    private TokenPair issueFreshSession(ApplicationUser user) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        RefreshToken session =
                refreshTokenRepository.findByUser(user).orElseGet(RefreshToken::new);
        session.setUser(user);
        session.setTokenHash(TokenHashes.sha256Hex(refreshToken));
        session.setPreviousTokenHash(null);
        session.setPreviousTokenExpiresAt(null);
        refreshTokenRepository.save(session);
        return new TokenPair(accessToken, refreshToken);
    }

    private ApplicationUser requireUser(String email) {
        return applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));
    }

    private String orUnknown(String value) {
        return value != null && !value.isBlank() ? value : "Unknown";
    }
}
