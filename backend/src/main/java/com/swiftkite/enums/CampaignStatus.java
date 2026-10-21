package com.swiftkite.enums;

/**
 * Campaign lifecycle. There is no FAILED/PAUSED/CANCELLED: individual
 * recipients can fail, but the campaign itself only starts and completes.
 * See the v1 LLD section 6.2.
 */
public enum CampaignStatus {
    DRAFT,
    SCHEDULED,
    SENDING,
    COMPLETED;

    public boolean canTransitionTo(CampaignStatus next) {
        return switch (this) {
            case DRAFT -> next == SCHEDULED || next == SENDING;
            case SCHEDULED -> next == DRAFT || next == SENDING;
            case SENDING -> next == COMPLETED;
            case COMPLETED -> false;
        };
    }
}
