package com.swiftkite.services.implementation;

import com.swiftkite.provider.EmailMessage;
import com.swiftkite.provider.EmailProvider;
import com.swiftkite.provider.ProviderException;
import com.swiftkite.util.Html;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Sends the password reset link through the configured provider. Failures are
 * logged and swallowed: the forgot-password response must stay generic and must
 * not reveal whether the address exists. The reset URL/token is never logged.
 */
@Component
@Slf4j
public class PasswordResetNotifier {

    private final EmailProvider emailProvider;
    private final String fromName;
    private final String fromEmail;
    private final long expiryMinutes;

    public PasswordResetNotifier(
            EmailProvider emailProvider,
            @Value("${app.mail.from-name}") String fromName,
            @Value("${app.mail.from-email}") String fromEmail,
            @Value("${app.auth.reset-token-expiry-minutes}") long expiryMinutes) {
        this.emailProvider = emailProvider;
        this.fromName = fromName;
        this.fromEmail = fromEmail;
        this.expiryMinutes = expiryMinutes;
    }

    public void send(String email, String resetUrl) {
        EmailMessage message = new EmailMessage(
                fromName,
                fromEmail,
                null,
                email,
                "Reset your SwiftKite password",
                buildHtml(resetUrl),
                buildText(resetUrl));

        try {
            emailProvider.send(message);
            log.info("Password reset email accepted for {}", email);
        } catch (ProviderException ex) {
            // Keep the API response generic; the token stays valid until expiry
            // so the user can retry the form.
            log.error("Password reset email failed for {}: {}", email, ex.getMessage());
        }
    }

    private String buildHtml(String resetUrl) {
        String href = Html.escape(resetUrl);
        return "<!doctype html><html><body style=\"font-family:Arial,sans-serif;line-height:1.5\">"
                + "<p>We received a request to reset your SwiftKite password.</p>"
                + "<p><a href=\"" + href + "\" "
                + "style=\"display:inline-block;padding:10px 16px;background:#111827;color:#ffffff;"
                + "text-decoration:none;border-radius:6px\">Reset password</a></p>"
                + "<p>This link expires in " + expiryMinutes + " minutes. "
                + "If you did not request it, you can ignore this email.</p>"
                + "</body></html>";
    }

    private String buildText(String resetUrl) {
        return "We received a request to reset your SwiftKite password.\n\n"
                + "Open this link to choose a new password:\n" + resetUrl + "\n\n"
                + "This link expires in " + expiryMinutes + " minutes. "
                + "If you did not request it, you can ignore this email.";
    }
}
