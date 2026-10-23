package com.swiftkite.dto.recipient;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Renames a per-recipient field for every recipient that has it: the value is
 * moved from {@code from} to {@code to} and the old key is dropped. Used to fix
 * a placeholder name without editing every recipient.
 */
@Data
public class RenameRecipientFieldRequest {
    @NotBlank(message = "Current column name is required.")
    @Size(max = 100, message = "Column name must be at most 100 characters.")
    private String from;

    @NotBlank(message = "New column name is required.")
    @Size(max = 100, message = "Column name must be at most 100 characters.")
    private String to;

    /** When true, replace values already stored under the new name. Defaults to false. */
    private boolean overwrite;
}
