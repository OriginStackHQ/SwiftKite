package com.swiftkite.validation;

/**
 * Single source of truth for the password policy used by every auth DTO. The
 * frontend mirrors these rules; keep them in sync.
 */
public final class PasswordPolicy {
    public static final String REGEX =
            "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!])(?=\\S+$).{6,}$";

    public static final String MESSAGE =
            "Password must be at least 6 characters long and contain at least one digit, one lowercase letter, "
                    + "one uppercase letter, one special character (@#$%^&+=!), and no whitespace.";

    public static final int NAME_MAX_LENGTH = 100;

    private PasswordPolicy() {}
}
