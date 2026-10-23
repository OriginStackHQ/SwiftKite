package com.swiftkite.controller;

import com.swiftkite.services.interfaces.IWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/webhooks")
public class WebhookController {

    private final IWebhookService webhookService;

    public WebhookController(IWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/email")
    public ResponseEntity<Void> email(
            @RequestHeader(value = "svix-id", required = false) String svixId,
            @RequestHeader(value = "svix-timestamp", required = false) String svixTimestamp,
            @RequestHeader(value = "svix-signature", required = false) String svixSignature,
            @RequestBody(required = false) byte[] body) {
        webhookService.handleEmailWebhook(svixId, svixTimestamp, svixSignature, body);
        return ResponseEntity.ok().build();
    }
}
