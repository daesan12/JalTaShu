package com.s15p21b103.good_tashu.admin.repository;

import com.s15p21b103.good_tashu.user.domain.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
public interface AdminUserRepository extends JpaRepository<UserEntity, Long> {
    interface UserSummary {
        Long getUserId();
        String getNickname();
        LocalDateTime getRecentUsingAt();
        String getUserStatement();
    }

    @Query(value = """
            WITH latest_usage AS (
                SELECT user_id, MAX(rental_at) AS recentUsingAt
                FROM cycle_usages
                GROUP BY user_id
            ), active_bans AS (
                SELECT DISTINCT user_id
                FROM user_ban_records
                WHERE started_at <= :now
                  AND scheduled_end_at > :now
                  AND released_at IS NULL
            ), user_status AS (
                SELECT u.user_id AS userId,
                       u.nickname AS nickname,
                       lu.recentUsingAt,
                       CASE WHEN ab.user_id IS NULL THEN 'NORMAL' ELSE 'BANNED' END AS userStatement
                FROM users u
                LEFT JOIN latest_usage lu ON lu.user_id = u.user_id
                LEFT JOIN active_bans ab ON ab.user_id = u.user_id
            )
            SELECT userId, nickname, recentUsingAt, userStatement
            FROM user_status
            WHERE (:statement IS NULL OR :statement = '' OR userStatement = :statement)
            ORDER BY
                CASE WHEN recentUsingAt IS NULL THEN 1 ELSE 0 END,
                CASE WHEN :order = 'oldest' THEN recentUsingAt END ASC,
                CASE WHEN :order = 'newest' THEN recentUsingAt END DESC,
                userId ASC
            """, nativeQuery = true)
    List<UserSummary> findUserSummaries(@Param("statement") String statement,
                                         @Param("order") String order,
                                         @Param("now") LocalDateTime now);
}
