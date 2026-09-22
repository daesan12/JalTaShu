package com.s15p21b103.good_tashu.admin.repository;

import com.s15p21b103.good_tashu.admin.domain.UserBanRecordEntity;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserBanRecordRepository extends JpaRepository<UserBanRecordEntity, Long> {
    @EntityGraph(attributePaths = "admin")
    List<UserBanRecordEntity> findAllByUser_UserIdOrderByStartedAtDescIdDesc(Long userId);

    Optional<UserBanRecordEntity> findFirstByUser_UserIdAndReleasedAtIsNullAndScheduledEndAtAfter(
            Long userId, LocalDateTime now);

    @Query(value = """
            SELECT b.*
            FROM user_ban_records b
            WHERE b.user_id = :userId
              AND b.started_at <= :now
              AND b.scheduled_end_at > :now
              AND b.released_at IS NULL
            ORDER BY b.started_at DESC, b.id DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<UserBanRecordEntity> findLatestActiveBan(
            @Param("userId") Long userId, @Param("now") LocalDateTime now);

    @Modifying
    @Query("""
            update UserBanRecordEntity b set b.releasedAt = :now
            where b.id = :banRecordId
              and b.startedAt <= :now
              and b.scheduledEndAt > :now
              and b.releasedAt is null
            """)
    int releaseActiveBan(Long banRecordId, LocalDateTime now);

}
