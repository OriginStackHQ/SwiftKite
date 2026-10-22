package com.swiftkite.util;

/** Minimal HTML escaping for values interpolated into email bodies. */
public final class Html {

    private Html() {
    }

    public static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
