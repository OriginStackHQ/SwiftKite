package com.swiftkite.dto.campaign;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Editable campaign fields, shared by create and full update. The sender
 * <em>address</em> is not here on purpose: SwiftKite sends through its own
 * provider account, so the address comes from {@code app.mail.from-email}.
 * Only the display name is user-editable.
 */
@Data
public abstract class CampaignWriteRequest {
    @NotBlank(message = "Campaign name is required.")
    @Size(max = 200, message = "Campaign name must be at most 200 characters.")
    private String name;

    @NotBlank(message = "Subject template is required.")
    @Size(max = 500, message = "Subject template must be at most 500 characters.")
    private String subjectTemplate;

    @Size(max = 500, message = "Preview text must be at most 500 characters.")
    private String previewText;

    @NotBlank(message = "Body template is required.")
    @Size(max = 200_000, message = "Body template must be at most 200000 characters.")
    private String bodyTemplate;

    @Size(max = 100, message = "Sender name must be at most 100 characters.")
    private String fromName;
}
