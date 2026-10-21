package com.swiftkite.enums;

/**
 * Subscriber lifecycle. BOUNCED and COMPLAINED are terminal and are never
 * auto-reactivated. See the v1 LLD section 6.1.
 */
public enum SubscriberStatus {
    PENDING,
    ACTIVE,
    UNSUBSCRIBED,
    BOUNCED,
    COMPLAINED;

    public boolean canTransitionTo(SubscriberStatus next) {
        return switch (this) {
            case PENDING -> next == ACTIVE || next == UNSUBSCRIBED || next == BOUNCED || next == COMPLAINED;
            case ACTIVE -> next == UNSUBSCRIBED || next == BOUNCED || next == COMPLAINED;
            case UNSUBSCRIBED -> next == PENDING || next == BOUNCED || next == COMPLAINED;
            case BOUNCED, COMPLAINED -> false;
        };
    }
}
