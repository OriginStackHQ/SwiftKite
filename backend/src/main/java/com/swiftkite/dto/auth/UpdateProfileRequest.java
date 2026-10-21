package com.swiftkite.dto.auth;

import com.swiftkite.validation.PasswordPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @NotBlank(message = "First name is required.")
    @Size(max = PasswordPolicy.NAME_MAX_LENGTH, message = "First name must be at most 100 characters.")
    private String firstName;

    @NotBlank(message = "Last name is required.")
    @Size(max = PasswordPolicy.NAME_MAX_LENGTH, message = "Last name must be at most 100 characters.")
    private String lastName;
}
