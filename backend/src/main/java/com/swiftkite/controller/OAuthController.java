package com.swiftkite.controller;

import com.swiftkite.dto.auth.AuthResponse;
import com.swiftkite.dto.auth.LinkTokenResponse;
import com.swiftkite.dto.auth.OAuthExchangeRequest;
import com.swiftkite.dto.auth.ProvidersResponse;
import com.swiftkite.dto.auth.SignInResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.enums.AuthProvider;
import com.swiftkite.exception.AppException;
import com.swiftkite.services.implementation.SessionCookieService;
import com.swiftkite.services.interfaces.IOAuthService;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@Tag(name = "OAuth", description = "Google OAuth exchange and provider linking")
@RequestMapping("/api/auth")
public class OAuthController {
    private final IOAuthService oAuthService;
    private final SessionCookieService cookieService;

    public OAuthController(IOAuthService oAuthService, SessionCookieService cookieService) {
        this.oAuthService = oAuthService;
        this.cookieService = cookieService;
    }

    /** Exchanges the one-time login code from the OAuth callback for a session. */
    @PostMapping("/oauth/exchange")
    public ResponseEntity<SignInResponse> exchange(@Valid @RequestBody OAuthExchangeRequest request) {
        AuthResponse pair = oAuthService.exchangeCode(request);
        ResponseCookie cookie = cookieService.issue(pair.getRefreshToken());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new SignInResponse(pair.getAccessToken()));
    }

    /**
     * Issues a short-lived token proving account ownership for the link handshake.
     */
    @GetMapping("/providers/link-token")
    public ResponseEntity<LinkTokenResponse> linkToken(@AuthenticationPrincipal ApplicationUser user) {
        return ResponseEntity.ok(oAuthService.issueLinkToken(user.getEmail()));
    }

    /** Lists linked providers plus whether a password is set (settings page). */
    @GetMapping("/providers")
    public ResponseEntity<ProvidersResponse> providers(@AuthenticationPrincipal ApplicationUser user) {
        return ResponseEntity.ok(oAuthService.providers(user.getEmail()));
    }

    @DeleteMapping("/providers/{provider}")
    public ResponseEntity<Void> unlink(
            @AuthenticationPrincipal ApplicationUser user, @PathVariable String provider) {
        final AuthProvider authProvider;
        try {
            authProvider = AuthProvider.valueOf(provider.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Unknown provider: " + provider, HttpStatus.BAD_REQUEST);
        }
        oAuthService.unlinkProvider(user.getEmail(), authProvider);
        return ResponseEntity.noContent().build();
    }
}
