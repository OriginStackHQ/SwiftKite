package com.swiftkite.services.interfaces;

import com.swiftkite.dto.auth.ChangePasswordRequest;
import com.swiftkite.dto.auth.SignInRequest;
import com.swiftkite.dto.auth.AuthResponse;
import com.swiftkite.dto.auth.SignUpRequest;
import com.swiftkite.dto.auth.SetPasswordRequest;
import com.swiftkite.dto.auth.UpdateProfileRequest;
import com.swiftkite.dto.user.MeResponse;

import jakarta.validation.Valid;

public interface IAuthService {
    MeResponse signUp(@Valid SignUpRequest request);

    AuthResponse signIn(@Valid SignInRequest request);

    AuthResponse refreshToken(String rawRefreshToken);

    void signOut(String rawRefreshToken, String rawAccessToken);

    /**
     * Sets a password on an account that does not have one (OAuth-created
     * accounts). Returns a rotated session so any previously issued sessions
     * are invalidated; the refresh part is null when no session existed.
     */
    AuthResponse setPassword(String email, @Valid SetPasswordRequest request);

    /**
     * Changes an existing password after verifying the current one. Returns a
     * rotated session so other devices are signed out.
     */
    AuthResponse changePassword(String email, @Valid ChangePasswordRequest request);

    /** Updates the display name; email changes are deliberately out of scope. */
    MeResponse updateProfile(String email, @Valid UpdateProfileRequest request);

    MeResponse me(String email);
}
