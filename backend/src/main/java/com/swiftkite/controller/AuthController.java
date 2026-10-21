package com.swiftkite.controller;

import com.swiftkite.dto.auth.AuthResponse;
import com.swiftkite.dto.auth.ChangePasswordRequest;
import com.swiftkite.dto.auth.ForgotPasswordRequest;
import com.swiftkite.dto.auth.MessageResponse;
import com.swiftkite.dto.auth.ResetPasswordRequest;
import com.swiftkite.dto.auth.SignInRequest;
import com.swiftkite.dto.auth.SignInResponse;
import com.swiftkite.dto.auth.SignUpRequest;
import com.swiftkite.dto.auth.SetPasswordRequest;
import com.swiftkite.dto.auth.UpdateProfileRequest;
import com.swiftkite.dto.user.MeResponse;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.services.implementation.SessionCookieService;
import com.swiftkite.services.interfaces.IAuthService;
import com.swiftkite.services.interfaces.IPasswordResetService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@Tag(name = "Authentication", description = "Sign-up, sign-in, refresh, sign-out and account management")
@RequestMapping("/api/auth")
public class AuthController {
    private final IAuthService authService;
    private final IPasswordResetService passwordResetService;
    private final SessionCookieService cookieService;

    public AuthController(
            IAuthService authService,
            IPasswordResetService passwordResetService,
            SessionCookieService cookieService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
        this.cookieService = cookieService;
    }

    @PostMapping("/sign-up")
    public ResponseEntity<MeResponse> signUp(@Valid @RequestBody SignUpRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signUp(request));
    }

    @PostMapping("/sign-in")
    public ResponseEntity<SignInResponse> signIn(@Valid @RequestBody SignInRequest request) {
        return withSessionCookie(authService.signIn(request));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<SignInResponse> refreshToken(
            @CookieValue(name = "${app.auth.cookie.name}", required = false) String refreshToken) {
        return withSessionCookie(authService.refreshToken(refreshToken));
    }

    @PostMapping("/sign-out")
    public ResponseEntity<Void> signOut(
            @CookieValue(name = "${app.auth.cookie.name}", required = false) String refreshCookie,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String accessToken = authHeader != null && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
        authService.signOut(refreshCookie, accessToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookieService.clear().toString())
                .build();
    }

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(@AuthenticationPrincipal ApplicationUser user) {
        return ResponseEntity.ok(authService.me(user.getEmail()));
    }

    /** Updates the creator's display name. */
    @PatchMapping("/me")
    public ResponseEntity<MeResponse> updateProfile(
            @AuthenticationPrincipal ApplicationUser user, @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(authService.updateProfile(user.getEmail(), request));
    }

    /**
     * Sets a password on an OAuth-created account so it can also sign in with
     * email + password. Rejected when a password already exists.
     */
    @PostMapping("/password")
    public ResponseEntity<SignInResponse> setPassword(
            @AuthenticationPrincipal ApplicationUser user, @Valid @RequestBody SetPasswordRequest request) {
        return respond(authService.setPassword(user.getEmail(), request));
    }

    /** Changes an existing password after verifying the current one. */
    @PostMapping("/password/change")
    public ResponseEntity<SignInResponse> changePassword(
            @AuthenticationPrincipal ApplicationUser user, @Valid @RequestBody ChangePasswordRequest request) {
        return respond(authService.changePassword(user.getEmail(), request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<MessageResponse> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(passwordResetService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request);
        return ResponseEntity.ok(new MessageResponse("Password reset. Sign in with your new password."));
    }

    private ResponseEntity<SignInResponse> respond(AuthResponse response) {
        if (response.getRefreshToken() == null) {
            return ResponseEntity.ok(new SignInResponse(response.getAccessToken()));
        }
        return withSessionCookie(response);
    }

    private ResponseEntity<SignInResponse> withSessionCookie(AuthResponse response) {
        ResponseCookie cookie = cookieService.issue(response.getRefreshToken());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new SignInResponse(response.getAccessToken()));
    }
}
