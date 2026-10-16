package com.swiftkite.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth.cookie")
public record CookieProps(String name, boolean secure, String sameSite, long maxAgeSeconds) {}
