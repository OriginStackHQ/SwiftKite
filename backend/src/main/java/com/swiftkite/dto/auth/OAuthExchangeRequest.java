package com.swiftkite.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OAuthExchangeRequest {
    @NotBlank(message = "Code is required.")
    private String code;

    /**
     Optional. When present, the exchanged Google identity is linked to the
     account the link token was issued for instead of creating/logging in a
     separate account. Issued by GET /api/auth/providers/link-token.
    */
    private String linkToken;
}
