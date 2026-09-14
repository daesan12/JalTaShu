package com.s15p21b103.good_tashu.user.service;


import com.s15p21b103.good_tashu._util.jwt.JwtProperties;
import com.s15p21b103.good_tashu._util.jwt.JwtService;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.dto.res.RefreshTokenResponseDto;
import com.s15p21b103.good_tashu._util.jwt.refresh_token.service.RefreshTokenService;
import com.s15p21b103.good_tashu.user.dto.req.InitUserRequestDto;
import com.s15p21b103.good_tashu.user.dto.res.TokenResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserService userService;
    private final RefreshTokenService refreshTokenService;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;

    // 서버 내부 전달용입니다. 이 객체 자체를 JSON 응답하지 않습니다.
    public record SignUpResult(
            TokenResponseDto accessToken,
            RefreshTokenResponseDto refreshToken
    ) {}

    // 이 조합 메서드를 기존 DB 트랜잭션 안에서 호출하지 못하도록 하는 안전장치
    // 새 트랜잭션을 만들지 않으며, 이미 트랜잭션이 있으면 실패
    @Transactional(propagation = Propagation.NEVER)
    public SignUpResult signUp(
            Long userId,
            String currentAuthVersion,
            String rawRefreshToken,
            InitUserRequestDto request
    ) {
        // 1. 잘못된 RT로 회원가입 DB 변경부터 수행하지 않도록 사전 검사
        refreshTokenService.validateForUser(
                rawRefreshToken,
                userId,
                currentAuthVersion
        );

        // 2. 별도 Bean의 @Transactional 메서드 호출
        userService.signUp(userId, request);

        // 위 호출이 정상 반환했다면 DB 커밋까지 완료된 상태입니다.

        // 3. 커밋 이후 현재 인증 상태를 다시 확인하고 Rotation
        RefreshTokenResponseDto rotated =
                refreshTokenService.rotateForUser(
                        rawRefreshToken,
                        userId,
                        currentAuthVersion
                );

        // 4. 커밋된 USER 권한과 새 authVersion으로 AT 발급
        String accessToken = jwtService.createAccessToken(
                userId,
                rotated.authVersion()
        );

        return new SignUpResult(
                new TokenResponseDto(
                        accessToken,
                        "Bearer",
                        jwtProperties.accessTokenExpires().toSeconds()
                ),
                rotated
        );
    }
}
