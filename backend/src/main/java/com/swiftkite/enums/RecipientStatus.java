package com.swiftkite.enums;

/**
 * Per-recipient delivery state. See the v1 LLD section 6.3.
 *
 * <p>A {@code FAILED} row may still receive provider events, but only when it
 * failed with {@link FailureCode#OUTCOME_UNKNOWN}; use
 * {@link #canTransitionTo(RecipientStatus, FailureCode)} in that case.
 */
public enum RecipientStatus {
    QUEUED,
    ATTEMPTING,
    ACCEPTED,
    DELIVERED,
    DEFERRED,
    BOUNCED,
    COMPLAINED,
    FAILED,
    SKIPPED;

    public boolean canTransitionTo(RecipientStatus next) {
        return switch (this) {
            case QUEUED -> next == ATTEMPTING || next == SKIPPED || next == FAILED;
            case ATTEMPTING -> next == ACCEPTED || next == DEFERRED || next == FAILED || next == SKIPPED;
            case DEFERRED -> next == ATTEMPTING || next == FAILED || next == SKIPPED;
            case ACCEPTED -> next == DELIVERED || next == BOUNCED || next == COMPLAINED;
            case DELIVERED -> next == BOUNCED || next == COMPLAINED;
            // "Late truth wins": a provider event proves an ambiguous send landed.
            case FAILED -> next == DELIVERED || next == BOUNCED || next == COMPLAINED;
            case BOUNCED, COMPLAINED, SKIPPED -> false;
        };
    }

    /**
     * Same as {@link #canTransitionTo(RecipientStatus)}, but a transition out of
     * FAILED is allowed only when the row failed with OUTCOME_UNKNOWN.
     */
    public boolean canTransitionTo(RecipientStatus next, FailureCode failureCode) {
        if (this == FAILED && failureCode != FailureCode.OUTCOME_UNKNOWN) {
            return false;
        }
        return canTransitionTo(next);
    }
}
