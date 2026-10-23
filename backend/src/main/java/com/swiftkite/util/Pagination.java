package com.swiftkite.util;

import com.swiftkite.exception.AppException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

/** Shared page/size validation so every paginated endpoint behaves the same. */
public final class Pagination {
    public static final int MAX_SIZE = 100;

    private Pagination() {}

    public static PageRequest of(int page, int size, Sort sort) {
        if (page < 0) {
            throw new AppException("Page must be zero or greater.", HttpStatus.BAD_REQUEST);
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new AppException("Size must be between 1 and " + MAX_SIZE + ".", HttpStatus.BAD_REQUEST);
        }
        return PageRequest.of(page, size, sort);
    }
}
