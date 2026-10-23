package com.swiftkite.provider;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * Resend adapter (https://resend.com). Sends one email per request and maps
 * every outcome to {@link SendResult}; it never throws for control flow.
 */
@Component
public class ResendEmailProvider implements EmailProvider {

    private static final String DELIVERY_ID_HEADER = "X-SwiftKite-Delivery-Id";

    private final RestClient restClient;
    private final String apiKey;

    public ResendEmailProvider(
            @Value("${app.mail.base-url}") String baseUrl,
            @Value("${app.mail.api-key}") String apiKey) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(30));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
        this.apiKey = apiKey;
    }

    @Override
    public SendResult send(EmailMessage message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", formatFrom(message));
        body.put("to", List.of(message.getTo()));
        body.put("subject", message.getSubject());
        if (message.getHtml() != null) {
            body.put("html", message.getHtml());
        }
        if (message.getText() != null) {
            body.put("text", message.getText());
        }
        if (message.getReplyTo() != null && !message.getReplyTo().isBlank()) {
            body.put("reply_to", message.getReplyTo());
        }
        if (message.getDeliveryId() != null && !message.getDeliveryId().isBlank()) {
            // Header is useful if the provider echoes it; the tag is visible in
            // webhook payloads and lets us repair OUTCOME_UNKNOWN deliveries.
            body.put("headers", Map.of(DELIVERY_ID_HEADER, message.getDeliveryId()));
            body.put(
                    "tags",
                    List.of(Map.of("name", "delivery_id", "value", message.getDeliveryId())));
        }

        try {
            ResendResponse response = restClient
                    .post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(body)
                    .retrieve()
                    .body(ResendResponse.class);

            if (response == null || response.id() == null || response.id().isBlank()) {
                return new SendResult.Unknown("Resend returned no message id; outcome unknown.");
            }
            return new SendResult.Accepted(response.id());
        } catch (RestClientResponseException ex) {
            return classifyResponse(ex);
        } catch (ResourceAccessException ex) {
            return new SendResult.Unknown(
                    "Resend request failed; outcome unknown: " + rootMessage(ex));
        } catch (RestClientException ex) {
            return new SendResult.Unknown(
                    "Resend request failed; outcome unknown: " + rootMessage(ex));
        }
    }

    private SendResult classifyResponse(RestClientResponseException ex) {
        int status = ex.getStatusCode().value();
        String detail = summarize(ex.getResponseBodyAsString());

        if (status == 401 || status == 403) {
            return new SendResult.AuthError();
        }
        if (status == 429) {
            return new SendResult.RateLimited();
        }
        if (status == 408) {
            return new SendResult.Unknown("Resend timed out; outcome unknown: " + detail);
        }
        if (status >= 500) {
            return new SendResult.Unknown(
                    "Resend server error (" + status + "); outcome unknown: " + detail);
        }
        return new SendResult.Rejected("Resend rejected the message (" + status + "): " + detail);
    }

    private static String formatFrom(EmailMessage message) {
        if (message.getFromName() == null || message.getFromName().isBlank()) {
            return message.getFromEmail();
        }
        return message.getFromName() + " <" + message.getFromEmail() + ">";
    }

    private static String summarize(String body) {
        if (body == null) {
            return "";
        }
        String trimmed = body.strip();
        return trimmed.length() <= 400 ? trimmed : trimmed.substring(0, 400) + "...";
    }

    private static String rootMessage(Throwable ex) {
        Throwable current = ex;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }

    private record ResendResponse(String id) {}
}
