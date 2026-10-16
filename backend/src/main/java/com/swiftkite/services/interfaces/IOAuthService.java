package com.swiftkite.services.interfaces;

import com.swiftkite.dto.auth.LinkTokenResponse;
import com.swiftkite.dto.auth.OAuthExchangeRequest;
import com.swiftkite.dto.auth.ProvidersResponse;
import com.swiftkite.enums.AuthProvider;
import com.swiftkite.services.implementation.AuthService.TokenPair;
import jakarta.validation.Valid;

public interface IOAuthService {
    TokenPair exchangeCode(@Valid OAuthExchangeRequest request);

    LinkTokenResponse issueLinkToken(String email);

    ProvidersResponse providers(String email);

    void unlinkProvider(String email, AuthProvider provider);
}
