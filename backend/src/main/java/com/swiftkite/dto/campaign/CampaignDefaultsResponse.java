package com.swiftkite.dto.campaign;

import lombok.AllArgsConstructor;
import lombok.Data;

/** Default sender offered to the campaign editor, sourced from {@code app.mail.*}. */
@Data
@AllArgsConstructor
public class CampaignDefaultsResponse {
    private String fromEmail;
    private String fromName;
}
