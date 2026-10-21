package com.swiftkite.config;

import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata for the generated docs (Swagger UI at {@code /swagger-ui.html},
 * JSON at {@code /v3/api-docs}).
 *
 * <p>The HTTP bearer scheme is declared and applied <strong>globally</strong>, so
 * controllers need no security annotations at all. Public endpoints inside an
 * otherwise-protected controller opt out with {@code @SecurityRequirements}
 * (empty) on the method. A public-only controller can put that annotation on
 * the class.
 *
 * <p>This is documentation only; access control lives in SecurityConfig and
 * PublicPaths.
 */
@Configuration
@SecurityScheme(
        name = OpenApiConfig.BEARER_SCHEME,
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        description = "Paste the access token returned by POST /api/auth/sign-in (no 'Bearer ' prefix).")
public class OpenApiConfig {

    public static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI swiftKiteOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("SwiftKite API")
                        .version("v1")
                        .description("""
                                Multi-tenant newsletter backend.

                                Authenticated calls use a JWT access token in the
                                `Authorization: Bearer <token>` header. The refresh token
                                lives in an HttpOnly cookie and is not exposed in the schema.

                                Errors use RFC 7807 `application/problem+json`.
                                """))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
    }
}
