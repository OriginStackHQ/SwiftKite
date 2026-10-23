package com.swiftkite.dto.recipient;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.Data;

@Data
public class AddRecipientsRequest {
    @NotEmpty(message = "At least one recipient is required.")
    @Size(max = 500, message = "At most 500 recipients can be added per call.")
    private List<@Valid RecipientInput> recipients = new ArrayList<>();

    @Data
    public static class RecipientInput {
        @NotBlank(message = "Recipient email is required.")
        @Email(message = "Recipient email should be valid.")
        @Size(max = 320, message = "Recipient email must be at most 320 characters.")
        private String email;

        /** Per-recipient placeholder values, e.g. {"name":"Asha","company":"Acme"}. */
        private Map<String, Object> data;
    }
}
