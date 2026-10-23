package com.swiftkite.services.implementation;

import com.swiftkite.config.RabbitConfig;
import com.swiftkite.entity.OutboxEvent;
import com.swiftkite.repository.OutboxEventRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/**
 * Publishes unpublished outbox rows to RabbitMQ. Publishing is at-least-once;
 * duplicate wake-up messages are safe because workers re-check the database.
 */
@Service
@Slf4j
public class OutboxRelay {

    private static final long CONFIRM_TIMEOUT_SECONDS = 5;

    private final OutboxEventRepository outboxEventRepository;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final int batchSize;
    private final TransactionTemplate transactionTemplate;

    public OutboxRelay(
            OutboxEventRepository outboxEventRepository,
            RabbitTemplate rabbitTemplate,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager,
            @Value("${app.outbox.batch-size}") int batchSize) {
        this.outboxEventRepository = outboxEventRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.batchSize = batchSize;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Scheduled(
            fixedDelayString = "${app.outbox.relay-delay-ms}",
            initialDelayString = "${app.outbox.initial-delay-ms}")
    public void relay() {
        transactionTemplate.executeWithoutResult(status -> relayOnce());
    }

    private void relayOnce() {
        List<OutboxEvent> events = outboxEventRepository.findUnpublishedForUpdate(batchSize);
        if (events.isEmpty()) {
            return;
        }

        Map<UUID, CorrelationData> pending = new LinkedHashMap<>();
        for (OutboxEvent event : events) {
            try {
                String payload = objectMapper.writeValueAsString(event.getPayload());
                CorrelationData correlation = new CorrelationData(event.getId().toString());
                rabbitTemplate.convertAndSend(
                        RabbitConfig.CAMPAIGN_EXCHANGE,
                        RabbitConfig.CAMPAIGN_SEND_ROUTING_KEY,
                        payload,
                        correlation);
                pending.put(event.getId(), correlation);
            } catch (Exception ex) {
                log.error("Could not publish outbox event {}: {}", event.getId(), ex.getMessage());
            }
        }

        OffsetDateTime now = OffsetDateTime.now();
        List<OutboxEvent> published = new ArrayList<>();
        for (OutboxEvent event : events) {
            CorrelationData correlation = pending.get(event.getId());
            if (correlation == null) {
                continue;
            }
            try {
                CorrelationData.Confirm confirm = correlation.getFuture().get(CONFIRM_TIMEOUT_SECONDS,
                        TimeUnit.SECONDS);
                if (confirm != null && confirm.ack()) {
                    event.setPublishedAt(now);
                    published.add(event);
                } else {
                    log.warn("RabbitMQ did not confirm outbox event {}.", event.getId());
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted while waiting for RabbitMQ confirm on {}.", event.getId());
                return;
            } catch (Exception ex) {
                log.warn(
                        "Timed out waiting for RabbitMQ confirm on outbox event {}: {}",
                        event.getId(),
                        ex.getMessage());
            }
        }

        if (!published.isEmpty()) {
            outboxEventRepository.saveAll(published);
        }
    }
}
