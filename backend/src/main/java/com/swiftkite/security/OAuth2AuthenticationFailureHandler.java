package com.swiftkite.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@Slf4j
public class OAuth2AuthenticationFailureHandler extends SimpleUrlAuthenticationFailureHandler {
    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.oauth2.frontend-callback-path}")
    private String frontendCallbackPath;

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException {
        log.warn("OAuth2 authentication failed: {}", exception.getMessage());

        // Only a coarse error marker travels in the URL â€” never tokens or details.
        String redirectUrl = UriComponentsBuilder.fromUriString(frontendUrl + frontendCallbackPath)
                .queryParam("error", "oauth_failed")
                .build()
                .toUriString();
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
