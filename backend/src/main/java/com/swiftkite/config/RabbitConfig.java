package com.swiftkite.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableRabbit
public class RabbitConfig {
    public static final String CAMPAIGN_EXCHANGE = "swiftkite.campaign";
    public static final String CAMPAIGN_SEND_ROUTING_KEY = "campaign.send";
    public static final String CAMPAIGN_SEND_QUEUE = "swiftkite.campaign.send";

    public static final String CAMPAIGN_DLX = "swiftkite.campaign.dlx";
    public static final String CAMPAIGN_SEND_DLQ = "swiftkite.campaign.send.dlq";
    public static final String CAMPAIGN_SEND_DLQ_ROUTING_KEY = "campaign.send.dlq";

    @Bean
    public TopicExchange campaignExchange() {
        return new TopicExchange(CAMPAIGN_EXCHANGE, true, false);
    }

    @Bean
    public Queue campaignSendQueue() {
        return QueueBuilder.durable(CAMPAIGN_SEND_QUEUE)
                .withArgument("x-dead-letter-exchange", CAMPAIGN_DLX)
                .withArgument("x-dead-letter-routing-key", CAMPAIGN_SEND_DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    public Binding campaignSendBinding() {
        return BindingBuilder.bind(campaignSendQueue())
                .to(campaignExchange())
                .with(CAMPAIGN_SEND_ROUTING_KEY);
    }

    @Bean
    public TopicExchange campaignDlx() {
        return new TopicExchange(CAMPAIGN_DLX, true, false);
    }

    @Bean
    public Queue campaignSendDlq() {
        return QueueBuilder.durable(CAMPAIGN_SEND_DLQ).build();
    }

    @Bean
    public Binding campaignSendDlqBinding() {
        return BindingBuilder.bind(campaignSendDlq())
                .to(campaignDlx())
                .with(CAMPAIGN_SEND_DLQ_ROUTING_KEY);
    }
}
