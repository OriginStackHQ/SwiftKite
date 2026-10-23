package com.swiftkite.util;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Renders {@code {{key}}} placeholders from a recipient's data. The built-in
 * {@code email} key always resolves to the recipient's email. Body values are
 * HTML-escaped; subject values are plain text.
 */
public final class TemplateRenderer {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*(\\w+)\\s*\\}\\}");

    private TemplateRenderer() {}

    public static Set<String> missingKeys(String template, Map<String, Object> data, String email) {
        Set<String> missing = new LinkedHashSet<>();
        for (String key : PlaceholderExtractor.extract(template)) {
            if (resolve(key, data, email) == null) {
                missing.add(key);
            }
        }
        return missing;
    }

    public static RenderedTemplate render(
            String template, Map<String, Object> data, String email, boolean htmlEscape) {
        String source = template == null ? "" : template;
        Matcher matcher = PLACEHOLDER.matcher(source);
        StringBuilder output = new StringBuilder();
        Set<String> missing = new LinkedHashSet<>();

        while (matcher.find()) {
            String key = matcher.group(1);
            Object value = resolve(key, data, email);
            if (value == null) {
                missing.add(key);
                matcher.appendReplacement(output, Matcher.quoteReplacement(matcher.group()));
                continue;
            }
            String replacement = String.valueOf(value);
            if (htmlEscape) {
                replacement = Html.escape(replacement);
            }
            matcher.appendReplacement(output, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(output);
        return new RenderedTemplate(output.toString(), Set.copyOf(missing));
    }

    private static Object resolve(String key, Map<String, Object> data, String email) {
        if ("email".equals(key)) {
            return email;
        }
        return data == null ? null : data.get(key);
    }

    public record RenderedTemplate(String value, Set<String> missingKeys) {}
}
