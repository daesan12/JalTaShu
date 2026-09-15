package com.s15p21b103.good_tashu._util.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "good-tashu.oauth2")
public record OAuth2Properties (
    @NotBlank
    String successUrl,

    @NotBlank
    String failureUrl
) {}