package com.swiftkite.enums;

public enum Provider {
    SES,
    SMTP,
    FAKE,
    /** Application-generated events, e.g. unsubscribe recorded without a provider callback. */
    SYSTEM
}
