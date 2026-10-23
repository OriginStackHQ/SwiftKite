package com.swiftkite.config;

import java.util.List;
import org.springframework.util.AntPathMatcher;

public class PublicPaths {
    private static final AntPathMatcher matcher = new AntPathMatcher();

    public static final String[] PATTERNS = {
            "/",
            "/api/auth/sign-up",
            "/api/auth/sign-in",
            "/api/auth/refresh-token",
            "/api/auth/sign-out",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/api/auth/oauth/exchange",
            "/api/webhooks/email",
            "/oauth2/authorization/**",
            "/login/oauth2/code/**",
            "/actuator/health",
            "/v3/api-docs",
            "/v3/api-docs/**",
            "/v3/api-docs.yaml",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/error"
    };

    public static boolean isPublic(String path) {
        return matchesAny(path, PATTERNS);
    }

    private static boolean matchesAny(String path, String[] patterns) {
        return List.of(patterns).stream().anyMatch(pattern -> matcher.match(pattern, path));
    }

    private PublicPaths() {
    }
}
