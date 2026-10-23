package com.swiftkite.dto.recipient;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;

/** Removes one or more per-recipient fields (typically unused placeholders). */
@Data
public class RemoveRecipientFieldsRequest {
    @NotEmpty(message = "At least one field is required.")
    @Size(max = 100, message = "At most 100 fields can be removed per call.")
    private List<@NotBlank(message = "Field name is required.")
            @Size(max = 100, message = "Field name must be at most 100 characters.") String>
            keys = new ArrayList<>();
}
