package com.swiftkite.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Public response body for sign-in, refresh and OAuth exchange. The refresh
 * token never travels in JSON — it is delivered as an httpOnly cookie by the
 * controllers.
 */
@Data
@AllArgsConstructor
public class SignInResponse {
    private String accessToken;
}
