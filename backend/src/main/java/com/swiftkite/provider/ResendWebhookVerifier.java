package com.swiftkite.provider;

import com.swiftkite.exception.AppException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Verifies Resend's Svix-style webhook signature over the raw request body.
 * See https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests.
 */
@Component
@Slf4j
public class ResendWebhookVerifier {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String SECRET_PREFIX = "whsec_";

    private final byte[] secret;
    private final long toleranceSeconds;

    public ResendWebhookVerifier(
            @Value("${app.webhook.resend.secret}") String rawSecret,
            @Value("${app.webhook.resend.tolerance-seconds}") long toleranceSeconds) {
        this.secret = decodeSecret(rawSecret);
        this.toleranceSeconds = toleranceSeconds;
        if (this.secret.length == 0) {
            log.warn("Resend webhook secret is not configured; all webhook calls will be rejected.");
        }
    }

    public void verify(String id, String timestamp, String signature, byte[] body) {
        if (secret.length == 0) {
            throw unauthorized("Webhook signing secret is not configured.");
        }
        if (isBlank(id) || isBlank(timestamp) || isBlank(signature)) {
            throw unauthorized("Missing webhook signature headers.");
        }

        long signedAt;
        try {
            signedAt = Long.parseLong(timestamp);
        } catch (NumberFormatException ex) {
            throw unauthorized("Invalid webhook timestamp.");
        }

        long now = Instant.now().getEpochSecond();
        if (Math.abs(now - signedAt) > toleranceSeconds) {
            throw unauthorized("Stale webhook timestamp.");
        }

        String payload = id + "." + timestamp + "."
                + new String(body == null ? new byte[0] : body, StandardCharsets.UTF_8);
        byte[] expected = hmac(payload);

        for (String candidate : signature.split("\\s+")) {
            int comma = candidate.indexOf(',');
            if (comma <= 0 || !"v1".equals(candidate.substring(0, comma))) {
                continue;
            }
            if (matches(expected, candidate.substring(comma + 1))) {
                return;
            }
        }

        throw unauthorized("Invalid webhook signature.");
    }

    private byte[] hmac(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            // Configuration should make this unreachable; fail closed if not.
            throw unauthorized("Could not verify webhook signature.");
        }
    }

    private static boolean matches(byte[] expected, String encoded) {
        try {
            byte[] provided = Base64.getDecoder().decode(encoded);
            return MessageDigest.isEqual(expected, provided);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static byte[] decodeSecret(String rawSecret) {
        if (isBlank(rawSecret)) {
            return new byte[0];
        }
        String value = rawSecret.startsWith(SECRET_PREFIX)
                ? rawSecret.substring(SECRET_PREFIX.length())
                : rawSecret;
        try {
            return Base64.getDecoder().decode(value);
        } catch (IllegalArgumentException ex) {
            // Accept a plain-text secret for local testing, but the Resend
            // dashboard always provides a base64 whsec_ value.
            return value.getBytes(StandardCharsets.UTF_8);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static AppException unauthorized(String message) {
        return new AppException(message, HttpStatus.UNAUTHORIZED);
    }
}
