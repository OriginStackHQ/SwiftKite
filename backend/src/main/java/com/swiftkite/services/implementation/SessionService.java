package com.swiftkite.services.implementation;

import com.swiftkite.dto.auth.AuthResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.entity.RefreshToken;
import com.swiftkite.exception.InvalidTokenException;
import com.swiftkite.repository.ApplicationUserRepository;
import com.swiftkite.repository.RefreshTokenRepository;
import com.swiftkite.util.TokenHashes;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

/**
 * Single owner of refresh-token session lifecycle: mint on login, rotate on
 * refresh (with reuse detection), revoke on sign-out. The refresh half only
 * ever leaves this class as an httpOnly cookie.
 */
@Service
@Validated
@Transactional
public class SessionService {
    private final RefreshTokenRepository refreshTokenRepository;
    private final ApplicationUserRepository applicationUserRepository;
    private final JwtService jwtService;

    @Value("${app.auth.refresh-reuse-grace-seconds}")
    private long reuseGraceSeconds;

    public SessionService(
            RefreshTokenRepository refreshTokenRepository,
            ApplicationUserRepository applicationUserRepository,
            JwtService jwtService) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.applicationUserRepository = applicationUserRepository;
        this.jwtService = jwtService;
    }

    /** Fresh login: a new lineage, orphaning any token stolen from the old one. */
    public AuthResponse start(ApplicationUser user) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        RefreshToken session = refreshTokenRepository.findByUser(user).orElseGet(RefreshToken::new);
        session.setUser(user);
        session.setTokenHash(TokenHashes.sha256Hex(refreshToken));
        session.setPreviousTokenHash(null);
        session.setPreviousTokenExpiresAt(null);
        refreshTokenRepository.save(session);

        return new AuthResponse(accessToken, refreshToken);
    }

    /**
     * Rotates the presented refresh token. A retry of the immediately previous
     * token inside the grace window is accepted (concurrent tabs); anything
     * older is a replay, so the lineage is revoked and re-authentication is
     * forced. {@code noRollbackFor} makes that revocation commit even though
     * the failure is reported by throwing.
     */
    @Transactional(noRollbackFor = InvalidTokenException.class)
    public AuthResponse rotate(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new InvalidTokenException("Refresh token is missing.");
        }

        String email;
        try {
            if (!jwtService.isRefreshToken(rawRefreshToken)) {
                throw new InvalidTokenException("Invalid refresh token.");
            }
            email = jwtService.extractEmail(rawRefreshToken);
        } catch (InvalidTokenException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidTokenException("Invalid refresh token.");
        }

        ApplicationUser user = applicationUserRepository
                .findByEmail(email)
                .orElseThrow(() -> new InvalidTokenException("Invalid refresh token."));
        RefreshToken session = refreshTokenRepository
                .findByUser(user)
                .orElseThrow(() -> new InvalidTokenException("Session not found. Please sign in again."));

        String presentedHash = TokenHashes.sha256Hex(rawRefreshToken);
        OffsetDateTime now = OffsetDateTime.now();

        if (presentedHash.equals(session.getTokenHash())) {
            return rotateRow(session, user, now);
        }
        if (presentedHash.equals(session.getPreviousTokenHash())
                && session.getPreviousTokenExpiresAt() != null
                && now.isBefore(session.getPreviousTokenExpiresAt())) {
            return rotateRow(session, user, now);
        }

        refreshTokenRepository.delete(session);
        throw new InvalidTokenException("Refresh token reuse detected. Please sign in again.");
    }

    /**
     * Credential change: rotate the live session so the caller stays signed in
     * and other holders are signed out. Returns an access token only when the
     * user has no session row to rotate.
     */
    public AuthResponse rotateFor(ApplicationUser user) {
        Optional<RefreshToken> session = refreshTokenRepository.findByUser(user);
        if (session.isPresent()) {
            return rotateRow(session.get(), user, OffsetDateTime.now());
        }
        return new AuthResponse(jwtService.generateAccessToken(user), null);
    }

    /** Revokes the user's session, e.g. after a password reset. */
    public void revokeAll(ApplicationUser user) {
        refreshTokenRepository.findByUser(user).ifPresent(refreshTokenRepository::delete);
    }

    /** Idempotent sign-out: revokes whatever the caller still holds. */
    public void revoke(String rawRefreshToken, String rawAccessToken) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            Optional<RefreshToken> byHash =
                    refreshTokenRepository.findByTokenHash(TokenHashes.sha256Hex(rawRefreshToken));
            if (byHash.isPresent()) {
                refreshTokenRepository.delete(byHash.get());
                return;
            }
            // The cookie may still hold the previous token during the rotation
            // grace window: resolve the owner from the JWT and revoke the lineage.
            if (revokeByTokenSubject(rawRefreshToken)) {
                return;
            }
        }
        if (rawAccessToken != null && !rawAccessToken.isBlank()) {
            revokeByTokenSubject(rawAccessToken);
        }
    }

    private AuthResponse rotateRow(RefreshToken session, ApplicationUser user, OffsetDateTime now) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        session.setPreviousTokenHash(session.getTokenHash());
        session.setPreviousTokenExpiresAt(now.plusSeconds(reuseGraceSeconds));
        session.setTokenHash(TokenHashes.sha256Hex(refreshToken));
        refreshTokenRepository.save(session);

        return new AuthResponse(accessToken, refreshToken);
    }

    /** Best-effort revocation by JWT subject; sign-out stays idempotent. */
    private boolean revokeByTokenSubject(String token) {
        try {
            String email = jwtService.extractEmail(token);
            return applicationUserRepository
                    .findByEmail(email)
                    .map(user -> {
                        refreshTokenRepository.findByUser(user).ifPresent(refreshTokenRepository::delete);
                        return true;
                    })
                    .orElse(false);
        } catch (Exception ignored) {
            // Already signed out, expired or malformed: nothing to revoke.
            return false;
        }
    }
}
