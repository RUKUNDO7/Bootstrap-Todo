package com.example.todo.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtService {
  private final SecretKey signingKey;
  private final long ttlMillis;

  public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.ttl-ms:86400000}") long ttlMillis) {
    this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    this.ttlMillis = ttlMillis;
  }

  public String generateToken(AppUserPrincipal principal) {
    Instant now = Instant.now();
    Map<String, Object> claims = new HashMap<>();
    claims.put("uid", principal.getId());
    claims.put("role", principal.getRole());

    return Jwts.builder()
        .claims(claims)
        .subject(principal.getUsername())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plusMillis(ttlMillis)))
        .signWith(signingKey)
        .compact();
  }

  public String extractUsername(String token) {
    return extractAllClaims(token).getSubject();
  }

  public boolean isTokenValid(String token, AppUserPrincipal principal) {
    Claims claims = extractAllClaims(token);
    String username = claims.getSubject();
    Date expiration = claims.getExpiration();
    return username.equalsIgnoreCase(principal.getUsername()) && expiration.after(new Date());
  }

  private Claims extractAllClaims(String token) {
    return Jwts.parser()
        .verifyWith(signingKey)
        .build()
        .parseSignedClaims(token)
        .getPayload();
  }
}
