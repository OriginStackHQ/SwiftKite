package com.swiftkite.dto.recipient;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PreviewResponse {
    private String subject;
    private String body;
}
