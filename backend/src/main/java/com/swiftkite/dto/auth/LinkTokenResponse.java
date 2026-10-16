package com.swiftkite.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LinkTokenResponse {
    private String linkToken;
}
