package com.swiftkite.services.implementation;

import com.swiftkite.entity.ApplicationUser;
import com.swiftkite.repository.RefreshTokenRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class JwtService {
    private static final String PURPOSE_CLAIM = "purpose";
    private static final String PURPOSE_LINK = "link";

    @Value("${app.auth.jwt.secret-key}")
    private String secretKey;

    @Value("${app.auth.jwt.access-token-expiration-ms}")
    private long accessTokenExpire;

    @Value("${app.auth.jwt.refresh-token-expiration-ms}")
    private long refreshTokenExpire;

    @Value("${app.oauth2.link-token-expiry-minutes}")
    private int linkTokenExpiryMinutes;

    private final RefreshTokenRepository refreshTokenRepository;

    public JwtService(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
    }

    public String generateAccessToken(ApplicationUser user) {
        return generateToken(user, accessTokenExpire, Map.of());
    }

    public String generateRefreshToken(ApplicationUser user) {
        return generateToken(user, refreshTokenExpire, Map.of());
    }

    /**
     * Short-lived token proving account ownership for the provider-link handshake.
     */
    public String generateLinkToken(ApplicationUser user) {
        long expiryMs = linkTokenExpiryMinutes * 60_000L;
        return generateToken(user, expiryMs, Map.of(PURPOSE_CLAIM, PURPOSE_LINK));
    }

    private String generateToken(ApplicationUser user, long expireTimeMs, Map<String, Object> extra) {
        Map<String, Object> extraClaims = new HashMap<>(extra);
        List<String> roles = user.getRoles().stream()
                .map(role -> role.getName().name())
                .toList();
        extraClaims.put("roles", roles);
        extraClaims.put("email", user.getEmail());

        return Jwts.builder()
                .subject(user.getEmail())
                .claims(extraClaims)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expireTimeMs))
                .signWith(getSignInKey())
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String email = extractEmail(token);
        return email.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public boolean isRefreshTokenValid(String token, UserDetails userDetails) {
        final String email = extractEmail(token);
        boolean isPresent = refreshTokenRepository
                .findByTokenHash(com.swiftkite.util.TokenHashes.sha256Hex(token))
                .isPresent();
        return email.equals(userDetails.getUsername()) && !isTokenExpired(token) && isPresent;
    }

    public boolean isLinkToken(String token) {
        return PURPOSE_LINK.equals(extractClaim(token, claims -> claims.get(PURPOSE_CLAIM, String.class)));
    }

    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoles(String token) {
        return extractClaim(token, claims -> claims.get("roles", List.class));
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSignInKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private SecretKey getSignInKey() {
        byte[] keyBytes = Decoders.BASE64URL.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
