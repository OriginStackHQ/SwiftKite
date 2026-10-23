package com.swiftkite.dto.delivery;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;

/** Snapshot returned by the claim query, before the provider call. */
@Data
@AllArgsConstructor
public class ClaimedDelivery {
    private UUID id;
    private UUID campaignId;
    private String email;
    private String renderedSubject;
    private String renderedBody;
    private String fromEmail;
    private String fromName;
}
