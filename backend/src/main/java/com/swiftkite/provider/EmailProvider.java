package com.swiftkite.provider;

/**
 * Account email sender. Business code depends on this seam; adapters translate
 * a message to their provider's wire format.
 */
public interface EmailProvider {

    SendResult send(EmailMessage message) throws ProviderException;
}
