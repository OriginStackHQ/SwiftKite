package com.swiftkite.provider;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * One email to send. {@code deliveryId} is the correlation id used by the
 * campaign send path; it is null for account mail such as password resets.
 */
@Data
@AllArgsConstructor
public class EmailMessage {
    private String fromName;
    private String fromEmail;
    private String replyTo;
    private String to;
    private String subject;
    private String html;
    private String text;
    private String deliveryId;
}
