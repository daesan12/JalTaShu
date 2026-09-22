package com.s15p21b103.good_tashu._util.jwt;

import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.exception.UserErrorCode;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JwtService {
    private final JwtProperties jwtProperties;
    private final UserRepository userRepository;
    private final JwtEncoder jwtEncoder;

    public String createAdminAccessToken(Long adminId, String authVersion) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(jwtProperties.issuer())
                .subject("admin:" + adminId)
                .audience(List.of(jwtProperties.audience()))
                .expiresAt(now.plus(jwtProperties.accessTokenExpires()))
                .issuedAt(now)
                .id(UUID.randomUUID().toString())
                .claim("client_id", jwtProperties.clientId())
                .claim("principalType", "ADMIN")
                .claim("authVersion", authVersion)
                .claim("roles", List.of("ADMIN"))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("at+jwt").build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
    
    // Access Token 생성
    public String createAccessToken(Long userId, String authVersion) {
        // 현재 시간
        Instant now = Instant.now();
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(UserErrorCode.NOT_EXISTS_USER));

        // RFC 9068에 필요한 claim 설정(iss, sub, aud, exp, iat, jti, client_id)
        // roles로 권한도 claim에 추가
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(jwtProperties.issuer())
                .subject(userId.toString())
                .audience(List.of(jwtProperties.audience()))
                .expiresAt(now.plus(jwtProperties.accessTokenExpires()))
                .issuedAt(now)
                .id(UUID.randomUUID().toString())
                .claim("client_id", jwtProperties.clientId())
                .claim("roles", List.of(user.getRole().name()))
                .claim("authVersion", authVersion)
                .build();

        // at+jwt 검증기 (RFC 9068)에 따라 at+jwt 타입임을 명시
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256)
                .type("at+jwt")
                .build();

        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
