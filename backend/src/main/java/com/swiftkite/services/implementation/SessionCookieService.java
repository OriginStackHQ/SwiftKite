package com.swiftkite.services.implementation;

import com.swiftkite.config.CookieProps;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Builds and clears the refresh-token session cookie. SameSite=Lax (never
 * None) is what makes cookie-based refresh CSRF-safe: cross-site requests
 * simply don't carry the cookie.
 */
@Component
public class SessionCookieService {
    private final CookieProps cookieProps;

    public SessionCookieService(CookieProps cookieProps) {
        this.cookieProps = cookieProps;
    }

    public ResponseCookie issue(String refreshToken) {
        return ResponseCookie.from(cookieProps.name(), refreshToken)
                .httpOnly(true)
                .secure(cookieProps.secure())
                .sameSite(cookieProps.sameSite())
                .path("/")
                .maxAge(Duration.ofSeconds(cookieProps.maxAgeSeconds()))
                .build();
    }

    public ResponseCookie clear() {
        return ResponseCookie.from(cookieProps.name(), "")
                .httpOnly(true)
                .secure(cookieProps.secure())
                .sameSite(cookieProps.sameSite())
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
    }

    public String cookieName() {
        return cookieProps.name();
    }
}
