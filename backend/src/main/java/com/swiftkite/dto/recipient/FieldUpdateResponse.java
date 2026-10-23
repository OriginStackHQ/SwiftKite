package com.swiftkite.dto.recipient;

import lombok.AllArgsConstructor;
import lombok.Data;

/** Number of recipients changed by a bulk field edit. */
@Data
@AllArgsConstructor
public class FieldUpdateResponse {
    private int updated;
}
