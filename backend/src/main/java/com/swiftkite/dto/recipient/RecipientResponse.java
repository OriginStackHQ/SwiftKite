package com.swiftkite.dto.recipient;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RecipientResponse {
    private UUID id;
    private String email;
    private Map<String, Object> data;
    private OffsetDateTime createdAt;
}
