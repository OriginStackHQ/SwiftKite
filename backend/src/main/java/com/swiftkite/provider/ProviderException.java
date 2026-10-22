package com.swiftkite.provider;

/**
 * The three possible outcomes of a send. Callers must not blindly retry; when
 * in doubt the outcome is ambiguous.
 */
public sealed class ProviderException extends Exception
        permits ProviderException.RecipientPermanentException,
                ProviderException.SystemicProviderException,
                ProviderException.AmbiguousOutcomeException {

    protected ProviderException(String message) {
        super(message);
    }

    protected ProviderException(String message, Throwable cause) {
        super(message, cause);
    }

    /** The address/content will never be accepted. */
    public static final class RecipientPermanentException extends ProviderException {
        public RecipientPermanentException(String message) {
            super(message);
        }

        public RecipientPermanentException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /** Account/config problem: auth, quota, outage. */
    public static final class SystemicProviderException extends ProviderException {
        public SystemicProviderException(String message) {
            super(message);
        }

        public SystemicProviderException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /** May or may not have been accepted. Never retried. */
    public static final class AmbiguousOutcomeException extends ProviderException {
        public AmbiguousOutcomeException(String message) {
            super(message);
        }

        public AmbiguousOutcomeException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
