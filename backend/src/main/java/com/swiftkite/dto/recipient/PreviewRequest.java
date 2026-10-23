package com.swiftkite.dto.recipient;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import java.util.Map;
import lombok.Data;

@Data
public class PreviewRequest {
    @Email(message = "Recipient email should be valid.")
    @Size(max = 320, message = "Recipient email must be at most 320 characters.")
    private String email;

    /** Inline data for a preview that is not tied to a stored recipient. */
    private Map<String, Object> data;
}
