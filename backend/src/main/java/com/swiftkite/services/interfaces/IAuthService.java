package com.swiftkite.services.interfaces;

import com.swiftkite.dto.auth.SignInRequest;
import com.swiftkite.dto.auth.SignInResponse;
import com.swiftkite.dto.auth.SignUpRequest;
import com.swiftkite.dto.auth.SetPasswordRequest;
import com.swiftkite.dto.user.MeResponse;
import com.swiftkite.services.implementation.AuthService.TokenPair;
import jakarta.validation.Valid;

public interface IAuthService {
    MeResponse signUp(@Valid SignUpRequest request);

    TokenPair signIn(@Valid SignInRequest request);

    TokenPair refreshToken(String rawRefreshToken);

    void signOut(String rawRefreshToken, String rawAccessToken);

    /**
     Sets a password on an account that does not have one (OAuth-created
     accounts). Returns a rotated session so any previously issued sessions
     are invalidated; the refresh part is null when no session existed.
    */
    TokenPair setPassword(String email, @Valid SetPasswordRequest request);

    MeResponse me(String email);
}
