package com.swiftkite.dto.delivery;

import com.swiftkite.enums.DeliveryStatus;
import com.swiftkite.enums.FailureCode;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DeliveryResponse {
    private UUID id;
    private UUID recipientId;
    private String email;
    private DeliveryStatus status;
    private FailureCode failureCode;
    private String providerMessageId;
    private String detail;
    private OffsetDateTime acceptedAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
