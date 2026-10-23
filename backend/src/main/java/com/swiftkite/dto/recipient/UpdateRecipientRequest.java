package com.swiftkite.dto.recipient;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import lombok.Data;

/** Full replacement of a draft recipient's email and placeholder values. */
@Data
public class UpdateRecipientRequest {
    @NotBlank(message = "Recipient email is required.")
    @Email(message = "Recipient email should be valid.")
    @Size(max = 320, message = "Recipient email must be at most 320 characters.")
    private String email;

    /** Per-recipient placeholder values, e.g. {"name":"Asha","company":"Acme"}. */
    private Map<String, Object> data;
}
