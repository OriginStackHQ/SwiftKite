package com.swiftkite.dto.user;

import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class MeResponse {
    private UUID id;
    private String email;
    private String firstName;
    private String lastName;
    private List<String> roles;
    private List<String> providers;
    private boolean hasPassword;
}
