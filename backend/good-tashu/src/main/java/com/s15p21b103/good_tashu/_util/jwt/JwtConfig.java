package com.s15p21b103.good_tashu._util.jwt;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

@Configuration
public class JwtConfig {
    @Bean
    public SecretKey jwtSecretKey(
            JwtProperties jwtProperties
    ) {
        byte[] keyBytes = Base64.getDecoder().decode(jwtProperties.secret());

        if(keyBytes.length < 32) {
            throw new IllegalArgumentException(
                    "JWT 비밀키는 Base64 디코딩 후 32바이트 이상이어야 합니다."
            );
        }
        
        // SHA256의 시크릿 키 반환
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }

    // Jwt Encoder
    @Bean
    public JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        // Nimbus Jwt Encoder를 설정
        return new NimbusJwtEncoder(
                new ImmutableSecret<>(jwtSecretKey)
        );
    }

    // Jwt Decoder
    @Bean
    public JwtDecoder accessTokenJwtDecoder(
           SecretKey jwtSecretKey,
           JwtProperties jwtProperties,
           AuthVersionValidator authVersionValidator,
           AdminAccessTokenValidator adminAccessTokenValidator
    ) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder
                .withSecretKey(jwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                //Nimbus의 기본 typ 검증을 끄고, createAtJwtValidator()가 access token에 맞는 typ를 검증하도록
                .validateType(false)
                .build();

        // iat값이 없을 때 Spring Security에서 exp로 임의로 생성하는 문제 해결
        var claimConverter = MappedJwtClaimSetConverter.withDefaults(java.util.Map.of());
        decoder.setClaimSetConverter(claims -> {
            var converted = claimConverter.convert(claims);
            if (!claims.containsKey("iat")) converted.remove("iat");
            return converted;
        });

        // JWT의 내용이 유효한지 검사할 검증 규칙 객체
        OAuth2TokenValidator<Jwt> accessTokenValidator =
                // at+jwt 검증기 사용 (RFC 9068)
                // RFC 9068의 검증기는 iss, sub, aud, exp, iat, jti, client_id가 필수
                JwtValidators.createAtJwtValidator()
                        // aud, 토큰의 수신 대상(토큰을 사용할 API) 설정
                        .audience(jwtProperties.audience())
                        // iss, 발급자 설정
                        .issuer(jwtProperties.issuer())
                        // client_id, 대상 클라이언트(토큰 발급을 요청한 앱) 검증
                        .clientId(jwtProperties.clientId())
                        // authVersion확인
                        .build();
        // decoder에 jwt 검증기(validator) 연결
        decoder.setJwtValidator(jwt -> {
            if (jwt.getIssuedAt() == null) {
                return org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.failure(
                        new org.springframework.security.oauth2.core.OAuth2Error(
                                "invalid_token", "Missing issued-at claim", null));
            }
            var result = accessTokenValidator.validate(jwt);
            if(result.hasErrors())
                return result;
            Object roles = jwt.getClaims().get("roles");
            boolean userRole = java.util.List.of("USER").equals(roles)
                    || java.util.List.of("GUEST").equals(roles);
            if (jwt.hasClaim("principalType") || jwt.getSubject().startsWith("admin:") || !userRole) {
                return adminAccessTokenValidator.validate(jwt);
            }
            return authVersionValidator.validate(jwt);
        });
        return decoder;
    }

    // 현재 권한 ("USER")에 "ROLE_" 접두사를 붙이는 converter 작성
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        // JWT에서 권한을 추출해 Collection<GrantedAuthority>로 변환
        JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter =
                new JwtGrantedAuthoritiesConverter();
        // jwt에서 "roles" 클레임을 사용해서 권한을 읽는다.
        grantedAuthoritiesConverter.setAuthoritiesClaimName("roles");
        // 해당 권한 값마다 "ROLE_" 접두사를 붙인다.
        grantedAuthoritiesConverter.setAuthorityPrefix("ROLE_");
        
        // jwt를 인증 객체로 변환할 converter 생성
        JwtAuthenticationConverter converter =
                new JwtAuthenticationConverter();

        // 두 converter를 연결
        // jwt에서 권한을 추출할 때 grantedAuthoritiesConverter를 사용하도록 지정
        converter.setJwtGrantedAuthoritiesConverter(
                grantedAuthoritiesConverter
        );
        return converter;
    }
    
    

}
