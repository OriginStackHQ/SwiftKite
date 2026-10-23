package com.swiftkite.exception;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;

/** Send/preview failed because one or more placeholders have no value. */
@Getter
public class MissingPlaceholderException extends RuntimeException {
    private final List<MissingPlaceholder> missing;

    public MissingPlaceholderException(List<MissingPlaceholder> missing) {
        super("Some recipients are missing placeholder values.");
        this.missing = List.copyOf(missing);
    }

    @Data
    @AllArgsConstructor
    public static class MissingPlaceholder {
        private UUID recipientId;
        private String email;
        private Set<String> keys;
    }
}
