package com.swiftkite.dto.auth;

import java.time.OffsetDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ProvidersResponse {
    private boolean hasPassword;
    private List<LinkedProvider> providers;

    @Data
    @AllArgsConstructor
    public static class LinkedProvider {
        private String provider;
        private OffsetDateTime linkedAt;
    }
}
