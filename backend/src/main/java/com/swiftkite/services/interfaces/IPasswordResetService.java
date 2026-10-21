package com.swiftkite.services.interfaces;

import com.swiftkite.dto.auth.ForgotPasswordRequest;
import com.swiftkite.dto.auth.MessageResponse;
import com.swiftkite.dto.auth.ResetPasswordRequest;
import jakarta.validation.Valid;

public interface IPasswordResetService {
    /**
     * Always returns the same generic message so the endpoint cannot be used to
     * enumerate accounts. A reset link is only generated for a real user.
     */
    MessageResponse forgotPassword(@Valid ForgotPasswordRequest request);

    /** Consumes a single-use reset token and signs the user out everywhere. */
    void resetPassword(@Valid ResetPasswordRequest request);
}
