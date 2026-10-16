package com.swiftkite.security;

import com.swiftkite.dto.auth.OAuthUserInfo;
import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.entity.OAuthLoginCode;
import com.swiftkite.entity.UserIdentity;
import com.swiftkite.enums.AuthProvider;
import com.swiftkite.repository.ApplicationUserRepository;
import com.swiftkite.repository.OAuthLoginCodeRepository;
import com.swiftkite.repository.UserIdentityRepository;
import com.swiftkite.util.TokenHashes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Bridges the Google redirect to the SPA. Only a short-lived, single-use
 * login code ever travels in the redirect URL â€” tokens are issued by the
 * exchange endpoint, never exposed to browser history or logs.
 */
@Component
@Slf4j
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {
    private final ApplicationUserRepository userRepository;
    private final UserIdentityRepository identityRepository;
    private final OAuthLoginCodeRepository codeRepository;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.oauth2.frontend-callback-path}")
    private String frontendCallbackPath;

    @Value("${app.oauth2.code-expiry-minutes}")
    private int codeExpiryMinutes;

    public OAuth2AuthenticationSuccessHandler(
            ApplicationUserRepository userRepository,
            UserIdentityRepository identityRepository,
            OAuthLoginCodeRepository codeRepository) {
        this.userRepository = userRepository;
        this.identityRepository = identityRepository;
        this.codeRepository = codeRepository;
    }

    @Override
    @Transactional
    public void onAuthenticationSuccess(
            HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException {
        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        OAuth2User oAuth2User = token.getPrincipal();
        String registrationId = token.getAuthorizedClientRegistrationId();

        if (!"google".equals(registrationId)) {
            throw new IllegalStateException("Unknown provider: " + registrationId);
        }
        OAuthUserInfo userInfo = OAuthUserInfo.fromGoogle(oAuth2User);

        // Known Google identity -> code bound to the existing user.
        // Unknown identity -> code carries the Google profile; the exchange
        // endpoint auto-creates the account (Google always supplies email)
        // or links it when a link token is presented.
        Optional<UserIdentity> identity = identityRepository.findByProviderAndProviderId(
                AuthProvider.GOOGLE, userInfo.getProviderId());

        OAuthLoginCode code = new OAuthLoginCode();
        String rawCode = TokenHashes.randomCode();
        code.setCodeHash(TokenHashes.sha256Hex(rawCode));
        code.setUser(identity.map(UserIdentity::getUser).orElse(null));
        code.setProvider(AuthProvider.GOOGLE);
        code.setProviderId(userInfo.getProviderId());
        code.setEmail(userInfo.getEmail());
        code.setFirstName(userInfo.getFirstName());
        code.setLastName(userInfo.getLastName());
        code.setExpiresAt(OffsetDateTime.now().plusMinutes(codeExpiryMinutes));
        codeRepository.save(code);

        String redirectUrl = UriComponentsBuilder.fromUriString(frontendUrl + frontendCallbackPath)
                .queryParam("code", rawCode)
                .queryParam("provider", "google")
                .build()
                .toUriString();
        log.debug("OAuth login code issued for provider {}", userInfo.getProviderId());
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
