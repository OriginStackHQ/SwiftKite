/**
 * Mirrors {@code com.swiftkite.validation.PasswordPolicy} and the entity column
 * limits. Keep this file in sync with the backend DTOs.
 */
export const PASSWORD_MIN_LENGTH = 6;
export const NAME_MAX_LENGTH = 100;

/** Same expression as the backend: 6+ chars, upper/lower/digit/special, no whitespace. */
export const PASSWORD_REGEX =
  /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!])(?=\S+$).{6,}$/;

export const PASSWORD_MESSAGE =
  "Use at least 6 characters with an uppercase letter, a lowercase letter, a number, a special character (@#$%^&+=!), and no spaces.";
