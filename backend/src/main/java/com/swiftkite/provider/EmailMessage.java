package com.swiftkite.provider;

/** One account email (password reset) to send. */
public record EmailMessage(
        String fromName,
        String fromEmail,
        String replyTo,
        String to,
        String subject,
        String html,
        String text) {}
