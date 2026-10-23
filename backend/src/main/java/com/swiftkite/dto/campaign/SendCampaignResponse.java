package com.swiftkite.dto.campaign;

import com.swiftkite.enums.CampaignStatus;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SendCampaignResponse {
    private UUID id;
    private CampaignStatus status;
    private int recipients;
}
