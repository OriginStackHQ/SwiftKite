package com.swiftkite.services.implementation;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Delivery seam for password reset links. A real email provider lands with the
 * newsletter email pipeline; until then the link is written to the backend log.
 */
@Component
@Slf4j
public class PasswordResetNotifier {
    public void send(String email, String resetUrl) {
        log.info("Password reset link for {}: {}", email, resetUrl);
    }
}
