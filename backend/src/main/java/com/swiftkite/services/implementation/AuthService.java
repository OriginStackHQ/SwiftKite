package com.swiftkite.services.implementation;

import com.swiftkite.dto.auth.SignInRequest;
import com.swiftkite.dto.auth.SignUpRequest;
import com.swiftkite.dto.auth.SetPasswordRequest;
import com.swiftkite.dto.user.MeResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.entity.RefreshToken;
import com.swiftkite.entity.Role;
import com.swiftkite.entity.UserIdentity;
import com.swiftkite.enums.AuthProvider;
import com.swiftkite.enums.RoleName;
import com.swiftkite.exception.AppException;
import com.swiftkite.exception.InvalidTokenException;
import com.swiftkite.exception.NotFoundException;
import com.swiftkite.exception.PasswordMismatchException;
import com.swiftkite.exception.ResourceAlreadyExistsException;
import com.swiftkite.repository.ApplicationUserRepository;
import com.swiftkite.repository.RefreshTokenRepository;
import com.swiftkite.repository.RoleRepository;
import com.swiftkite.repository.UserIdentityRepository;
import com.swiftkite.services.interfaces.IAuthService;
import com.swiftkite.util.TokenHashes;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
@Transactional
public class AuthService implements IAuthService {
    /** Internal token bundle; controllers expose accessToken in the body and refreshToken as a cookie. */
    public record TokenPair(String accessToken, String refreshToken) {}

    private final ApplicationUserRepository applicationUserRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserIdentityRepository userIdentityRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.auth.refresh-reuse-grace-seconds}")
    private long reuseGraceSeconds;

    public AuthService(
            ApplicationUserRepository applicationUserRepository,
            RoleRepository roleRepository,
            RefreshTokenRepository refreshTokenRepository,
            UserIdentityRepository userIdentityRepository,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            PasswordEncoder passwordEncoder) {
        this.applicationUserRepository = applicationUserRepository;
        this.roleRepository = roleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userIdentityRepository = userIdentityRepository;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public MeResponse signUp(@Valid SignUpRequest request) {
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new PasswordMismatchException("Passwords do not match.");
        }

        String email = request.getEmail().toLowerCase();
        if (applicationUserRepository.findByEmail(email).isPresent()) {
            throw new ResourceAlreadyExistsException("An account with this email already exists.");
        }

        Role creatorRole = roleRepository
                .findByName(RoleName.CREATOR)
                .orElseThrow(() -> new NotFoundException("Creator role not found."));

        ApplicationUser user = new ApplicationUser();
        user.setEmail(email);
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRoles(List.of(creatorRole));
        ApplicationUser saved = applicationUserRepository.save(user);

        UserIdentity localIdentity = new UserIdentity();
        localIdentity.setUser(saved);
        localIdentity.setProvider(AuthProvider.LOCAL);
        userIdentityRepository.save(localIdentity);

        return toMe(saved);
    }

    @Override
    public TokenPair signIn(@Valid SignInRequest request) {
        String email = request.getEmail().toLowerCase();
        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password."));

        if (user.getPassword() == null) {
            throw new AppException(
                    "This email is linked to a Google account. Please sign in with Google instead.",
                    HttpStatus.CONFLICT);
        }

        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(email, request.getPassword()));
        } catch (AuthenticationException e) {
            throw new BadCredentialsException("Invalid email or password.");
        }

        return issueFreshSession(user);
    }

    @Override
    public TokenPair refreshToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new InvalidTokenException("Refresh token is missing.");
        }

        String email;
        try {
            email = jwtService.extractEmail(rawRefreshToken);
        } catch (Exception e) {
            throw new InvalidTokenException("Invalid refresh token.");
        }
        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));

        RefreshToken session = refreshTokenRepository
                .findByUser(user)
                .orElseThrow(() -> new InvalidTokenException("Session not found. Please sign in again."));

        String presentedHash = TokenHashes.sha256Hex(rawRefreshToken);
        OffsetDateTime now = OffsetDateTime.now();

        if (presentedHash.equals(session.getTokenHash())) {
            return rotate(session, user, now);
        }

        // Concurrent retry of the immediately previous token inside the grace
        // window: rotate again instead of logging the user out.
        if (presentedHash.equals(session.getPreviousTokenHash())
                && session.getPreviousTokenExpiresAt() != null
                && now.isBefore(session.getPreviousTokenExpiresAt())) {
            return rotate(session, user, now);
        }

        // True replay of a stale token: two parties hold the lineage. Revoke
        // the whole family (this row) and force re-authentication.
        refreshTokenRepository.delete(session);
        throw new InvalidTokenException("Refresh token reuse detected. Please sign in again.");
    }

    @Override
    public void signOut(String rawRefreshToken, String rawAccessToken) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            refreshTokenRepository
                    .findByTokenHash(TokenHashes.sha256Hex(rawRefreshToken))
                    .ifPresent(refreshTokenRepository::delete);
            return;
        }
        if (rawAccessToken != null && !rawAccessToken.isBlank()) {
            try {
                String email = jwtService.extractEmail(rawAccessToken);
                applicationUserRepository.findByEmail(email).ifPresent(user -> refreshTokenRepository
                        .findByUser(user)
                        .ifPresent(refreshTokenRepository::delete));
            } catch (Exception ignored) {
                // Already signed out or malformed token â€” logout is idempotent.
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MeResponse me(String email) {
        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));
        return toMe(user);
    }

    @Override
    public TokenPair setPassword(String email, @Valid SetPasswordRequest request) {
        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found with email: " + email));

        if (user.getPassword() != null) {
            throw new AppException(
                    "Password is already set. Use change password instead.", HttpStatus.CONFLICT);
        }
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new PasswordMismatchException("Passwords do not match.");
        }
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        applicationUserRepository.save(user);

        if (!userIdentityRepository.existsByUserAndProvider(user, AuthProvider.LOCAL)) {
            UserIdentity localIdentity = new UserIdentity();
            localIdentity.setUser(user);
            localIdentity.setProvider(AuthProvider.LOCAL);
            userIdentityRepository.save(localIdentity);
        }

        // Credential change invalidates existing sessions: rotate if one
        // exists so the caller stays signed in, everyone else is signed out.
        Optional<RefreshToken> session = refreshTokenRepository.findByUser(user);
        if (session.isPresent()) {
            return rotate(session.get(), user, OffsetDateTime.now());
        }
        return new TokenPair(jwtService.generateAccessToken(user), null);
    }

    /** Fresh login always starts a new lineage, orphaning any stolen tokens. */
    private TokenPair issueFreshSession(ApplicationUser user) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        Optional<RefreshToken> existing = refreshTokenRepository.findByUser(user);
        RefreshToken session = existing.orElseGet(RefreshToken::new);
        session.setUser(user);
        session.setTokenHash(TokenHashes.sha256Hex(refreshToken));
        session.setPreviousTokenHash(null);
        session.setPreviousTokenExpiresAt(null);
        refreshTokenRepository.save(session);

        return new TokenPair(accessToken, refreshToken);
    }

    private TokenPair rotate(RefreshToken session, ApplicationUser user, OffsetDateTime now) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        session.setPreviousTokenHash(session.getTokenHash());
        session.setPreviousTokenExpiresAt(now.plusSeconds(reuseGraceSeconds));
        session.setTokenHash(TokenHashes.sha256Hex(refreshToken));
        refreshTokenRepository.save(session);

        return new TokenPair(accessToken, refreshToken);
    }

    public MeResponse toMe(ApplicationUser user) {
        List<String> roles =
                user.getRoles().stream().map(role -> role.getName().name()).toList();
        List<String> providers = userIdentityRepository.findByUser(user).stream()
                .map(identity -> identity.getProvider().name())
                .toList();
        return new MeResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                roles,
                providers,
                user.getPassword() != null);
    }
}
