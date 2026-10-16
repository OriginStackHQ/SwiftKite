package com.swiftkite.controller;

import com.swiftkite.dto.auth.SignInRequest;
import com.swiftkite.dto.auth.SignInResponse;
import com.swiftkite.dto.auth.SignUpRequest;
import com.swiftkite.dto.auth.SetPasswordRequest;
import com.swiftkite.dto.user.MeResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.services.implementation.AuthService.TokenPair;
import com.swiftkite.services.implementation.SessionCookieService;
import com.swiftkite.services.interfaces.IAuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/auth")
public class AuthController {
    private final IAuthService authService;
    private final SessionCookieService cookieService;

    public AuthController(IAuthService authService, SessionCookieService cookieService) {
        this.authService = authService;
        this.cookieService = cookieService;
    }

    @PostMapping("/sign-up")
    public ResponseEntity<MeResponse> signUp(@Valid @RequestBody SignUpRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signUp(request));
    }

    @PostMapping("/sign-in")
    public ResponseEntity<SignInResponse> signIn(@Valid @RequestBody SignInRequest request) {
        TokenPair pair = authService.signIn(request);
        return withSessionCookie(pair).body(new SignInResponse(pair.accessToken()));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<SignInResponse> refreshToken(
            @CookieValue(name = "${app.auth.cookie.name}", required = false) String refreshToken) {
        TokenPair pair = authService.refreshToken(refreshToken);
        return withSessionCookie(pair).body(new SignInResponse(pair.accessToken()));
    }

    @PostMapping("/sign-out")
    public ResponseEntity<Void> signOut(
            @CookieValue(name = "${app.auth.cookie.name}", required = false) String refreshCookie,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String accessToken =
                authHeader != null && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
        authService.signOut(refreshCookie, accessToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookieService.clear().toString())
                .build();
    }

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(@AuthenticationPrincipal ApplicationUser user) {
        return ResponseEntity.ok(authService.me(user.getEmail()));
    }

    /**
     Sets a password on an OAuth-created account so it can also sign in with
     email + password (settings page). Rejected when a password already exists.
    */
    @PostMapping("/password")
    public ResponseEntity<SignInResponse> setPassword(
            @AuthenticationPrincipal ApplicationUser user, @Valid @RequestBody SetPasswordRequest request) {
        TokenPair pair = authService.setPassword(user.getEmail(), request);
        if (pair.refreshToken() != null) {
            return withSessionCookie(pair).body(new SignInResponse(pair.accessToken()));
        }
        return ResponseEntity.ok(new SignInResponse(pair.accessToken()));
    }

    private ResponseEntity.BodyBuilder withSessionCookie(TokenPair pair) {
        ResponseCookie cookie = cookieService.issue(pair.refreshToken());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
