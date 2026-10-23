package com.swiftkite.dto.campaign;

import com.swiftkite.enums.CampaignStatus;
import com.swiftkite.enums.PausedReason;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CampaignDetailResponse {
    private UUID id;
    private String name;
    private String subjectTemplate;
    private String previewText;
    private String bodyTemplate;
    private String fromEmail;
    private String fromName;
    private CampaignStatus status;
    private PausedReason pausedReason;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private Map<String, Long> counts;
}
