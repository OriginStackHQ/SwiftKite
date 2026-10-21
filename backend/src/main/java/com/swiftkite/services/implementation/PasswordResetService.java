package com.swiftkite.services.implementation;

import com.swiftkite.dto.auth.ForgotPasswordRequest;
import com.swiftkite.dto.auth.MessageResponse;
import com.swiftkite.dto.auth.ResetPasswordRequest;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.entity.PasswordResetToken;
import com.swiftkite.entity.UserIdentity;
import com.swiftkite.enums.AuthProvider;
import com.swiftkite.exception.InvalidTokenException;
import com.swiftkite.exception.PasswordMismatchException;
import com.swiftkite.repository.ApplicationUserRepository;
import com.swiftkite.repository.PasswordResetTokenRepository;
import com.swiftkite.repository.UserIdentityRepository;
import com.swiftkite.services.interfaces.IPasswordResetService;
import com.swiftkite.util.TokenHashes;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

/**
 * Forgot/reset password flow. Reset tokens are single-use, stored as SHA-256
 * hashes, and expire after {@code app.auth.reset-token-expiry-minutes}.
 */
@Service
@Validated
public class PasswordResetService implements IPasswordResetService {
    private static final String GENERIC_MESSAGE =
            "If an account exists for that email, a reset link has been sent.";

    private final ApplicationUserRepository applicationUserRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final UserIdentityRepository userIdentityRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetNotifier notifier;
    private final SessionService sessionService;

    @Value("${app.auth.reset-token-expiry-minutes}")
    private long resetTokenExpiryMinutes;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public PasswordResetService(
            ApplicationUserRepository applicationUserRepository,
            PasswordResetTokenRepository resetTokenRepository,
            UserIdentityRepository userIdentityRepository,
            PasswordEncoder passwordEncoder,
            PasswordResetNotifier notifier,
            SessionService sessionService) {
        this.applicationUserRepository = applicationUserRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.userIdentityRepository = userIdentityRepository;
        this.passwordEncoder = passwordEncoder;
        this.notifier = notifier;
        this.sessionService = sessionService;
    }

    @Override
    @Transactional
    public MessageResponse forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        OffsetDateTime now = OffsetDateTime.now();
        resetTokenRepository.deleteByExpiresAtBefore(now);

        Optional<ApplicationUser> userOptional = applicationUserRepository.findByEmail(email);

        if (userOptional.isPresent()) {
            ApplicationUser user = userOptional.get();
            String rawToken = TokenHashes.randomCode();

            // One active reset per user: update in place to avoid a delete +
            // insert racing the unique user_id constraint.
            PasswordResetToken token =
                    resetTokenRepository.findByUser(user).orElseGet(PasswordResetToken::new);
            token.setUser(user);
            token.setTokenHash(TokenHashes.sha256Hex(rawToken));
            token.setExpiresAt(now.plusMinutes(resetTokenExpiryMinutes));
            resetTokenRepository.save(token);

            String resetUrl = frontendUrl + "/reset-password?token=" + rawToken;
            notifier.send(user.getEmail(), resetUrl);
        }

        return new MessageResponse(GENERIC_MESSAGE);
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new PasswordMismatchException("Passwords do not match.");
        }

        PasswordResetToken token = resetTokenRepository
                .findByTokenHash(TokenHashes.sha256Hex(request.getToken()))
                .orElseThrow(() -> new InvalidTokenException("This reset link is invalid or has expired."));

        if (token.getExpiresAt().isBefore(OffsetDateTime.now())) {
            resetTokenRepository.delete(token);
            throw new InvalidTokenException("This reset link is invalid or has expired.");
        }

        ApplicationUser user = token.getUser();
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        applicationUserRepository.save(user);

        if (!userIdentityRepository.existsByUserAndProvider(user, AuthProvider.LOCAL)) {
            UserIdentity localIdentity = new UserIdentity();
            localIdentity.setUser(user);
            localIdentity.setProvider(AuthProvider.LOCAL);
            userIdentityRepository.save(localIdentity);
        }

        // Single-use token and a credential change invalidates every session.
        resetTokenRepository.delete(token);
        sessionService.revokeAll(user);
    }
}
