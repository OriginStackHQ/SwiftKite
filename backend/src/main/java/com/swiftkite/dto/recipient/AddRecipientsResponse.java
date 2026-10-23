package com.swiftkite.dto.recipient;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AddRecipientsResponse {
    private int inserted;
    private int skipped;
}
