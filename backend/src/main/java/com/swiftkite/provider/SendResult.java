package com.swiftkite.provider;

/**
 * Outcome of one send. Callers must not blindly retry: {@link Unknown} means
 * the provider may have accepted the message. This is the control-flow result,
 * not an exception.
 */
public sealed interface SendResult {

    /** The provider accepted the message and issued an id. */
    record Accepted(String providerMessageId) implements SendResult {}

    /** The message will never be accepted (bad address/content). */
    record Rejected(String detail) implements SendResult {}

    /** Account/config problem: the provider rejected our credentials. */
    record AuthError() implements SendResult {}

    /** Provider rate limit; the message was not accepted. */
    record RateLimited() implements SendResult {}

    /** Timeout, 5xx, or network failure: the message may have been sent. */
    record Unknown(String detail) implements SendResult {}
}
