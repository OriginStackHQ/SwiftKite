package com.swiftkite.services.interfaces;

public interface IWebhookService {
    void handleEmailWebhook(
            String svixId, String svixTimestamp, String svixSignature, byte[] body);
}
