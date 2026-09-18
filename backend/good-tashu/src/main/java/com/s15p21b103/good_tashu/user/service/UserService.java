package com.s15p21b103.good_tashu.user.service;

import com.s15p21b103.good_tashu._util.jwt.refresh_token.service.RefreshTokenService;
import com.s15p21b103.good_tashu.cycle.repository.CycleUsageRepository;
import com.s15p21b103.good_tashu.user.domain.SocialLoginProvider;
import com.s15p21b103.good_tashu.user.domain.UserEntity;
import com.s15p21b103.good_tashu.user.domain.UserRole;
import com.s15p21b103.good_tashu.user.domain.UserTermEntity;
import com.s15p21b103.good_tashu.user.dto.req.InitUserRequestDto;
import com.s15p21b103.good_tashu.user.dto.res.UserMeResponse;
import com.s15p21b103.good_tashu.user.exception.UserErrorCode;
import com.s15p21b103.good_tashu.user.exception.UserException;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import com.s15p21b103.good_tashu.user.repository.UserTermRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final UserTermRepository userTermRepository;
    private final RefreshTokenService refreshTokenService;
    private final CycleUsageRepository cycleUsageRepository;

    static private final Set<String> REQUIRED_TERMS = Set.of("SERVICE", "PRIVACY", "LOCATION");

    @Transactional(readOnly = true)
    public UserMeResponse getMyInfo(Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(UserErrorCode.NOT_EXISTS_USER));

        LocalDate firstDay = LocalDate.now(ZoneId.of("Asia/Seoul")).withDayOfMonth(1);
        LocalDateTime monthStart = firstDay.atStartOfDay();
        LocalDateTime nextMonthStart = firstDay.plusMonths(1).atStartOfDay();
        CycleUsageRepository.MonthlyMoveStatistics statistics = cycleUsageRepository
                .getMonthlyMoveStatistics(userId, monthStart, nextMonthStart);

        BigDecimal distanceKm = null;
        Long distanceMeters = statistics.getMonthlyMoveDisMeters();
        if (distanceMeters != null) {
            distanceKm = BigDecimal.valueOf(distanceMeters)
                    .divide(BigDecimal.valueOf(1000), 1, RoundingMode.HALF_UP);
        }

        long timeMinutes = statistics.getMonthlyTimeSeconds() / 60;
        return new UserMeResponse(userId, user.getNickname(), statistics.getMonthlyMoveCnt(),
                distanceKm, timeMinutes);
    }

    
    // provider와 oauth2User를 받아서, 해당 객체를 찾아 반환하던가 혹은 생성하여 반환
    public UserEntity findOrCreate(SocialLoginProvider provider, OAuth2User oauth2User) {
        return userRepository.findByProviderAndProviderUserId(provider, oauth2User.getName())
                .orElseGet(()->userRepository.save(UserEntity.builder()
                        .provider(provider)
                        // oauth2User.getName()은 provider에서 제공하는 식별자이다.
                        .providerUserId(oauth2User.getName())
                        .nickname(null)
                        .role(UserRole.GUEST)
                        .build()));
    }


    // 회원가입
    @Transactional
    public void signUp(Long userId, InitUserRequestDto request) {
        // 첫 번째 항목(동의한 약관의 코드)만 가져와서 필수 동의항목에 모두 동의했는지 확인
        Set<String> agrees = Set.copyOf(request.agrees().stream().map(List::getFirst).toList());
        if(!agrees.containsAll(REQUIRED_TERMS))
            throw new UserException(UserErrorCode.NOT_AGREE_REQUIRED_TERMS);
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new UserException(UserErrorCode.NOT_EXISTS_USER));
        if (user.getRole() != UserRole.GUEST) {
            throw new UserException(UserErrorCode.FORBIDDEN);
        }
        // 이전에 해당 사용자가 해당 약관에 동의한 적이 있는지 확인하고, 있으면 버전 업데이트
        // 없으면 해당 약관을 삽입
        request.agrees().stream().forEach(term -> {
            String code = term.getFirst();
            String version = term.get(1);
            userTermRepository.findByUser_UserIdAndTermCode(userId, code)
                    .ifPresentOrElse(userTermEntity -> userTermEntity.setTermVersion(version),
                            () -> userTermRepository.save(UserTermEntity.builder()
                                    .user(user)
                                    .termCode(code)
                                    .termVersion(version)
                                    .build()));
        });

        // 닉네임 설정
        user.setNickname(request.nickname());

        // 닉네임과 권한을 설정했으므로 USER권한으로 올림
        user.setRole(UserRole.USER);
    }
}
