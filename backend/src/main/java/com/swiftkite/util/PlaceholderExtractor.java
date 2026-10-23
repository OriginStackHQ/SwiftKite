package com.swiftkite.util;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Extracts {@code {{key}}} placeholders from subject and body templates. */
public final class PlaceholderExtractor {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*(\\w+)\\s*\\}\\}");
    private static final Pattern EMPTY_PLACEHOLDER = Pattern.compile("\\{\\{\\s*\\}\\}");

    private PlaceholderExtractor() {}

    /** True when the template contains an empty/whitespace placeholder such as {@code {{}}}. */
    public static boolean hasEmptyPlaceholder(String template) {
        return template != null && EMPTY_PLACEHOLDER.matcher(template).find();
    }

    public static Set<String> extract(String template) {
        Set<String> keys = new LinkedHashSet<>();
        if (template == null) {
            return keys;
        }
        Matcher matcher = PLACEHOLDER.matcher(template);
        while (matcher.find()) {
            keys.add(matcher.group(1));
        }
        return keys;
    }
}
