package com.swiftkite.provider;

import com.swiftkite.provider.ProviderException.AmbiguousOutcomeException;
import com.swiftkite.provider.ProviderException.RecipientPermanentException;
import com.swiftkite.provider.ProviderException.SystemicProviderException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.net.ssl.SSLException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Resend adapter (https://resend.com). Sends one account email per request.
 */
@Component
public class ResendEmailProvider implements EmailProvider {

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
    public SendResult send(EmailMessage message) throws ProviderException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", formatFrom(message));
        body.put("to", List.of(message.to()));
        body.put("subject", message.subject());
        if (message.html() != null) {
            body.put("html", message.html());
        }
        if (message.text() != null) {
            body.put("text", message.text());
        }
        if (message.replyTo() != null && !message.replyTo().isBlank()) {
            body.put("reply_to", message.replyTo());
        }

        try {
            ResendResponse response = restClient
                    .post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .body(body)
                    .retrieve()
                    .body(ResendResponse.class);
            return new SendResult(response == null ? null : response.id());
        } catch (RestClientResponseException ex) {
            throw classifyResponse(ex);
        } catch (ResourceAccessException ex) {
            throw classifyTransport(ex);
        }
    }

    private ProviderException classifyResponse(RestClientResponseException ex) {
        int status = ex.getStatusCode().value();
        String detail = summarize(ex.getResponseBodyAsString());

        if (status == 401 || status == 403) {
            return new SystemicProviderException("Resend authentication failed: " + detail, ex);
        }
        if (status == 429) {
            return new SystemicProviderException("Resend rate limit exceeded: " + detail, ex);
        }
        if (status >= 400 && status < 500) {
            return new RecipientPermanentException("Resend rejected the recipient (" + status + "): " + detail, ex);
        }
        return new AmbiguousOutcomeException("Resend server error (" + status + "); outcome unknown: " + detail, ex);
    }

    private ProviderException classifyTransport(ResourceAccessException ex) {
        Throwable root = rootCause(ex);
        if (root instanceof ConnectException || root instanceof UnknownHostException || root instanceof SSLException) {
            return new SystemicProviderException("Resend connection failed: " + root.getMessage(), ex);
        }
        if (root instanceof HttpConnectTimeoutException) {
            return new SystemicProviderException("Resend connect timed out: " + root.getMessage(), ex);
        }
        if (root instanceof HttpTimeoutException || root instanceof SocketTimeoutException) {
            return new AmbiguousOutcomeException("Resend timed out; outcome unknown.", ex);
        }
        return new AmbiguousOutcomeException(
                "Resend request failed; outcome unknown: " + root.getMessage(), ex);
    }

    private static String formatFrom(EmailMessage message) {
        if (message.fromName() == null || message.fromName().isBlank()) {
            return message.fromEmail();
        }
        return message.fromName() + " <" + message.fromEmail() + ">";
    }

    private static String summarize(String body) {
        if (body == null) {
            return "";
        }
        String trimmed = body.strip();
        return trimmed.length() <= 400 ? trimmed : trimmed.substring(0, 400) + "...";
    }

    private static Throwable rootCause(Throwable ex) {
        Throwable current = ex;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }

    private record ResendResponse(String id) {}
}
