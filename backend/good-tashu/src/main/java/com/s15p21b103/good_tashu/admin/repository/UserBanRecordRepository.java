package com.s15p21b103.good_tashu.admin.repository;

import com.s15p21b103.good_tashu.admin.domain.UserBanRecordEntity;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.util.Optional;

public interface UserBanRecordRepository extends JpaRepository<UserBanRecordEntity, Long> {
    Optional<UserBanRecordEntity> findFirstByUser_UserIdAndReleasedAtIsNullAndScheduledEndAtAfter(
            Long userId, LocalDateTime now);

    @Modifying
    @Query("update UserBanRecordEntity b set b.releasedAt = :now "
            + "where b.user.userId = :userId and b.releasedAt is null")
    int releaseActiveBan(Long userId, LocalDateTime now);
}
