package com.swiftkite.services.implementation;

import com.swiftkite.config.RabbitConfig;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Receives the campaign wake-up message; the queue is only a signal. */
@Component
@Slf4j
public class CampaignSendListener {

    private final CampaignSendWorker worker;
    private final ObjectMapper objectMapper;

    public CampaignSendListener(CampaignSendWorker worker, ObjectMapper objectMapper) {
        this.worker = worker;
        this.objectMapper = objectMapper;
    }

    @RabbitListener(queues = RabbitConfig.CAMPAIGN_SEND_QUEUE, concurrency = "${app.worker.concurrency}")
    public void onMessage(Message message) {
        String payload = new String(message.getBody(), StandardCharsets.UTF_8);
        UUID campaignId = parseCampaignId(payload);
        if (campaignId == null) {
            log.warn("Rejecting malformed campaign wake-up message: {}", payload);
            throw new AmqpRejectAndDontRequeueException("Malformed campaign wake-up message");
        }

        worker.run(campaignId);
    }

    private UUID parseCampaignId(String payload) {
        try {
            JsonNode node = objectMapper.readTree(payload);
            JsonNode campaignId = node.get("campaignId");
            if (campaignId == null || !campaignId.isString()) {
                return null;
            }
            return UUID.fromString(campaignId.asString());
        } catch (Exception ex) {
            log.warn("Could not parse campaign wake-up message: {}", ex.getMessage());
            return null;
        }
    }
}
