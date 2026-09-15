package com.s15p21b103.good_tashu._util.jwt;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "good-tashu.jwt")
public record JwtProperties (
    @NotBlank
    @Size(min = 32)
    String secret,
    @NotBlank
    String issuer,
    @NotBlank
    String audience,
    @NotBlank
    String clientId,
    @NotNull
    Duration accessTokenExpires,
    @NotNull
    Duration refreshTokenExpires,
    @NotNull
    boolean secure,
    @NotBlank
    String cookiePath
) {
}
