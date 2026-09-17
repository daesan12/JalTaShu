package com.s15p21b103.good_tashu.admin.service;

import com.s15p21b103.good_tashu.admin.dto.res.AdminUserListResponse;
import com.s15p21b103.good_tashu.admin.dto.res.AdminUserBanHistoryResponse;
import com.s15p21b103.good_tashu.admin.repository.AdminUserRepository;
import com.s15p21b103.good_tashu.admin.repository.AdminRepository;
import com.s15p21b103.good_tashu.admin.repository.UserBanRecordRepository;
import com.s15p21b103.good_tashu.admin.domain.UserBanRecordEntity;
import com.s15p21b103.good_tashu.admin.domain.AdminEntity;
import com.s15p21b103.good_tashu.admin.dto.req.UserBanRequest;
import com.s15p21b103.good_tashu.user.repository.UserRepository;
import com.s15p21b103.good_tashu.admin.exception.AdminException;
import static com.s15p21b103.good_tashu.admin.exception.AdminErrorCode.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminUserService {
    private final AdminUserRepository adminUserRepository;
    private final AdminRepository adminRepository;
    private final UserRepository userRepository;
    private final UserBanRecordRepository userBanRecordRepository;
    private final PasswordEncoder passwordEncoder;

    //초기화 코드 전용. 이미 등록된 ID는 그대로 유지하며 비밀번호를 재설정하지 않음
    @Transactional
    public Long registerAdmin(String id, String rawPassword) {
        if (id == null || id.isBlank() || id.strip().length() > 20) {
            throw new AdminException(INVALID_ADMIN_ID);
        }
        // BCrypt의 입력 한도는 문자 수가 아닌 UTF-8 바이트 수입니다. 비밀번호는 trim하지 않습니다.
        if (rawPassword == null || rawPassword.isBlank()
                || rawPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new AdminException(INVALID_ADMIN_PASSWORD);
        }
        String loginId = id.strip();
        // 있으면 수정하지 않고 그대로 adminId를 반환
        return adminRepository.findByIdEquals(loginId)
                .map(AdminEntity::getAdminId)
                .orElseGet(() -> adminRepository.save(AdminEntity.builder()
                        .id(loginId)
                        .password(passwordEncoder.encode(rawPassword))
                        .build()).getAdminId());
    }

    @Transactional
    public void banUser(Long adminId, Long userId, UserBanRequest request) {
        // 제재를 실행한 관리자와 대상 사용자를 확인
        var admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_ADMIN));
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new AdminException(NOT_EXISTS_USER));
        // 현재 유효한 제재가 있으면 중복 제재 방지
        if (userBanRecordRepository.findFirstByUser_UserIdAndReleasedAtIsNullAndScheduledEndAtAfter(
                userId, java.time.LocalDateTime.now()).isPresent()) {
            throw new AdminException(ALREADY_BANNED);
        }
        // 제재 내역을 저장
        userBanRecordRepository.save(new UserBanRecordEntity(user, admin,
                request.scheduledEndAt(), request.comment()));
    }

    @Transactional
    public void releaseUserBan(Long banRecordId) {
        // 지정한 제재 기록이 현재 유효할 때만 한 건을 해제한다.
        int updated = userBanRecordRepository.releaseActiveBan(banRecordId, LocalDateTime.now());
        if (updated == 1) {
            return;
        }
        if (!userBanRecordRepository.existsById(banRecordId)) {
            throw new AdminException(NOT_EXISTS_BAN_RECORD);
        }
        throw new AdminException(NOT_ACTIVE_BAN_RECORD);
    }

    // 사용자의 전체 제재 이력을 최신순으로 조회한다.
    @Transactional(readOnly = true)
    public List<AdminUserBanHistoryResponse> getUserBanHistory(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new AdminException(NOT_EXISTS_USER);
        }

        return userBanRecordRepository.findAllByUser_UserIdOrderByStartedAtDescIdDesc(userId).stream()
                .map(this::toBanHistoryResponse)
                .toList();
    }

    private AdminUserBanHistoryResponse toBanHistoryResponse(UserBanRecordEntity ban) {
        // 조기 해제했다면 예정 시각보다 실제 해제 시각을 종료 시각으로 사용한다.
        LocalDateTime endAt = ban.getScheduledEndAt();
        if (ban.getReleasedAt() != null && ban.getReleasedAt().isBefore(endAt)) {
            endAt = ban.getReleasedAt();
        }

        long period = ChronoUnit.DAYS.between(ban.getStartedAt(), ban.getScheduledEndAt());
        return new AdminUserBanHistoryResponse(
                ban.getId(), ban.getStartedAt(), endAt, period,
                ban.getComment(), ban.getAdmin().getAdminId());
    }

    //최근 이용일과 현재 제재 상태를 사용자 목록으로 조회
    @Transactional(readOnly = true)
    public List<AdminUserListResponse> getUserList(String statement, String order) {
        // 허용된 필터·정렬 값으로 정규화 후 DB 조회
        String normalizedStatement = normalizeStatement(statement);
        String normalizedOrder = normalizeOrder(order);
        // 조회 결과를 관리자 화면용 응답 DTO로 변환
        return adminUserRepository.findUserSummaries(normalizedStatement, normalizedOrder).stream()
                .map(user -> new AdminUserListResponse(
                        user.getUserId(), user.getNickname(),
                        user.getRecentUsingAt(), user.getUserStatement()))
                .toList();
    }
    //유저상태 파라미터 검증
    private String normalizeStatement(String statement) {
        if (statement == null || statement.isBlank()) {
            return "";
        }
        String value = statement.strip().toUpperCase(Locale.ROOT);
        if (!value.equals("BANNED") && !value.equals("NORMAL")) {
            throw new AdminException(INVALID_STATEMENT);
        }
        return value;
    }
    //정렬순서 파라미터 검증
    private String normalizeOrder(String order) {
        if (order == null || order.isBlank()) {
            return "newest";
        }
        String value = order.strip().toLowerCase(Locale.ROOT);
        if (!value.equals("newest") && !value.equals("oldest")) {
            throw new AdminException(INVALID_ORDER);
        }
        return value;
    }
}
