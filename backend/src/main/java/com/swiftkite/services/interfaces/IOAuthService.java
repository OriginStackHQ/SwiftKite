package com.swiftkite.services.interfaces;

import com.swiftkite.dto.auth.AuthResponse;
import com.swiftkite.dto.auth.LinkTokenResponse;
import com.swiftkite.dto.auth.OAuthExchangeRequest;
import com.swiftkite.dto.auth.ProvidersResponse;
import com.swiftkite.enums.AuthProvider;
import jakarta.validation.Valid;

public interface IOAuthService {
    AuthResponse exchangeCode(@Valid OAuthExchangeRequest request);

    LinkTokenResponse issueLinkToken(String email);

    ProvidersResponse providers(String email);

    void unlinkProvider(String email, AuthProvider provider);
}
