package com.swiftkite.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Internal access/refresh bundle passed from services to controllers. Never
 * serialize this: response bodies expose {@link SignInResponse} only, while the
 * refresh token is set as an httpOnly cookie.
 */
@Data
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
}
