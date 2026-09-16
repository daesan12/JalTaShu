package com.s15p21b103.good_tashu.admin.repository;

import com.s15p21b103.good_tashu.cycle.domain.CycleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AdminCycleRepository extends JpaRepository<CycleEntity, String> {
    interface CycleHistoryRow {
        Long getRecordId();
        LocalDateTime getUsingAt();
        String getStartingPoint();
        String getEndPoint();
        Long getUserId();
        String getNickname();
    }

    // 미반납 이력과 대여소·사용자 정보가 없는 이력도 유지한다.
    @Query(value = """
            SELECT cu.cycle_usage_id AS recordId, cu.rental_at AS usingAt,
                   rental_station.name AS startingPoint, return_station.name AS endPoint,
                   cu.user_id AS userId, u.nickname AS nickname
            FROM cycle_usages cu
            LEFT JOIN stations rental_station ON rental_station.station_id = cu.rental_station_id
            LEFT JOIN stations return_station ON return_station.station_id = cu.return_station_id
            LEFT JOIN users u ON u.user_id = cu.user_id
            WHERE cu.cycle_id = :cycleId
            ORDER BY cu.rental_at DESC, cu.cycle_usage_id DESC
            """, nativeQuery = true)
    List<CycleHistoryRow> findCycleHistory(@Param("cycleId") String cycleId);

    interface CycleDetailStatistics {
        Long getUsingCnt();
        LocalDateTime getRecentUsingAt();
        Long getUnresolvedClaim();
        LocalDateTime getRegisteredAt();
    }

    // 이용내역과 제보를 별도로 집계해 건수가 중복되지 않도록 한다.
    @Query(value = """
            SELECT (SELECT COUNT(*) FROM cycle_usages cu
                    WHERE cu.cycle_id = c.cycle_id) AS usingCnt,
                   (SELECT MAX(cu.rental_at) FROM cycle_usages cu
                    WHERE cu.cycle_id = c.cycle_id) AS recentUsingAt,
                   (SELECT COUNT(*) FROM cycle_claims cc
                    JOIN cycle_usages claim_usage
                      ON claim_usage.cycle_usage_id = cc.cycle_usage_id
                    WHERE claim_usage.cycle_id = c.cycle_id AND cc.status = 'READY') AS unresolvedClaim,
                   c.registered_at AS registeredAt
            FROM cycles c
            WHERE c.cycle_id = :cycleId
            """, nativeQuery = true)
    Optional<CycleDetailStatistics> findCycleDetailStatistics(@Param("cycleId") String cycleId);

    interface CycleListRow {
        String getCycleId();
        String getCurrentLocation();
        String getStatement();
        LocalDateTime getRecentUsingAt();
        Long getClaimCnt();
    }

    // 이용내역과 제보를 각각 집계해 조인으로 인한 건수 중복을 방지한다.
    @Query(value = """
            SELECT c.cycle_id AS cycleId, s.name AS currentLocation,
                   c.status AS statement, usage_stats.recent_using_at AS recentUsingAt,
                   COALESCE(claim_stats.claim_cnt, 0) AS claimCnt
            FROM cycles c
            LEFT JOIN stations s ON s.station_id = c.station_id
            LEFT JOIN (
                SELECT cycle_id, MAX(rental_at) AS recent_using_at
                FROM cycle_usages GROUP BY cycle_id
            ) usage_stats ON usage_stats.cycle_id = c.cycle_id
            LEFT JOIN (
                SELECT claim_usage.cycle_id, COUNT(*) AS claim_cnt
                FROM cycle_claims cc
                JOIN cycle_usages claim_usage
                  ON claim_usage.cycle_usage_id = cc.cycle_usage_id
                WHERE cc.status = 'READY' GROUP BY claim_usage.cycle_id
            ) claim_stats ON claim_stats.cycle_id = c.cycle_id
            WHERE (:cycle = '' OR LOCATE(:cycle, c.cycle_id) > 0)
              AND (:stationName = '' OR LOCATE(:stationName, s.name) > 0)
              AND (:statement = '' OR c.status = :statement)
              AND (:hasClaim IS NULL
                   OR :hasClaim = FALSE
                   OR COALESCE(claim_stats.claim_cnt, 0) > 0)
            ORDER BY c.cycle_id
            """, nativeQuery = true)
    List<CycleListRow> findCycleList(@Param("cycle") String cycle,
                                     @Param("stationName") String stationName,
                                     @Param("statement") String statement,
                                     @Param("hasClaim") Boolean hasClaim);

    interface CycleStatistics {
        Long getTotalCycleCnt();
        Long getRentCycleCnt();
        Long getWaitCycleCnt();
        Long getClaimCycleCnt();
    }

    // 미처리 제보는 존재 여부만 확인해 자전거가 중복 집계되지 않도록 한다.
    @Query(value = """
            SELECT COUNT(*) AS totalCycleCnt,
                   COUNT(CASE WHEN c.status = 'RENTING' THEN 1 END) AS rentCycleCnt,
                   COUNT(CASE WHEN c.status = 'READY' THEN 1 END) AS waitCycleCnt,
                   COUNT(CASE WHEN EXISTS (
                       SELECT 1 FROM cycle_claims cc
                       JOIN cycle_usages claim_usage
                         ON claim_usage.cycle_usage_id = cc.cycle_usage_id
                       WHERE claim_usage.cycle_id = c.cycle_id AND cc.status = 'READY'
                   ) THEN 1 END) AS claimCycleCnt
            FROM cycles c
            """, nativeQuery = true)
    CycleStatistics findCycleStatistics();

    interface HeatmapRow {
        String getStationId();
        BigDecimal getXPos();
        BigDecimal getYPos();
        Long getRentCnt();
        Long getReturnCnt();
    }

    interface StationDetailStats {
        Long getCurrentBikeCnt();
        Long getTodayRentalCnt();
        Long getTodayReturnCnt();
        Long getCurrentReportCnt();
        Long getYesterdayBikeCnt();
        Long getYesterdayRentalCnt();
        Long getYesterdayReturnCnt();
        Long getYesterdayReportCnt();
    }

    interface StationTrendRow {
        String getDate();
        Long getRentalCnt();
        Long getReturnCnt();
    }

    // 대여·반납 이벤트를 합쳐 직전 1시간의 대여소별 건수를 집계한다.
    @Query(value = """
            SELECT s.station_id AS stationId, s.longitude AS xPos, s.latitude AS yPos,
                   SUM(events.rent_cnt) AS rentCnt, SUM(events.return_cnt) AS returnCnt
            FROM (
                SELECT cu.rental_station_id AS station_id,
                       1 AS rent_cnt, 0 AS return_cnt
                FROM cycle_usages cu
                WHERE cu.rental_at >= :from AND cu.rental_at < :to
                  AND cu.rental_station_id IS NOT NULL
                UNION ALL
                SELECT cu.return_station_id AS station_id,
                       0 AS rent_cnt, 1 AS return_cnt
                FROM cycle_usages cu
                WHERE cu.return_at >= :from AND cu.return_at < :to
                  AND cu.return_station_id IS NOT NULL
            ) events
            JOIN stations s ON s.station_id = events.station_id
            GROUP BY s.station_id, s.longitude, s.latitude
            ORDER BY s.station_id
            """, nativeQuery = true)
    List<HeatmapRow> findHeatmap(@Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to);

    // 어제 수량은 현재 수량에서 최근 24시간의 대여·반납 흐름을 역산한다.
    @Query(value = """
            SELECT
                (SELECT COUNT(*) FROM cycles c
                 WHERE c.station_id = :stationId AND c.status = 'READY') AS currentBikeCnt,
                (SELECT COUNT(*) FROM cycle_usages cu
                 WHERE cu.rental_station_id = :stationId
                   AND cu.rental_at >= CURRENT_DATE AND cu.rental_at < CURRENT_DATE + INTERVAL 1 DAY) AS todayRentalCnt,
                (SELECT COUNT(*) FROM cycle_usages cu
                 WHERE cu.return_station_id = :stationId
                   AND cu.return_at >= CURRENT_DATE AND cu.return_at < CURRENT_DATE + INTERVAL 1 DAY) AS todayReturnCnt,
                (SELECT COUNT(*) FROM cycle_claims cc
                 JOIN cycle_usages claim_usage ON claim_usage.cycle_usage_id = cc.cycle_usage_id
                 JOIN cycles c ON c.cycle_id = claim_usage.cycle_id
                 WHERE c.station_id = :stationId AND cc.status = 'READY') AS currentReportCnt,
                (SELECT COUNT(*) FROM cycles c WHERE c.station_id = :stationId AND c.status = 'READY')
                + (SELECT COUNT(*) FROM cycle_usages cu WHERE cu.rental_station_id = :stationId
                   AND cu.rental_at >= CURRENT_TIMESTAMP - INTERVAL 24 HOUR)
                - (SELECT COUNT(*) FROM cycle_usages cu WHERE cu.return_station_id = :stationId
                   AND cu.return_at >= CURRENT_TIMESTAMP - INTERVAL 24 HOUR) AS yesterdayBikeCnt,
                (SELECT COUNT(*) FROM cycle_usages cu WHERE cu.rental_station_id = :stationId
                   AND cu.rental_at >= CURRENT_DATE - INTERVAL 1 DAY
                   AND cu.rental_at < CURRENT_TIMESTAMP - INTERVAL 24 HOUR) AS yesterdayRentalCnt,
                (SELECT COUNT(*) FROM cycle_usages cu WHERE cu.return_station_id = :stationId
                   AND cu.return_at >= CURRENT_DATE - INTERVAL 1 DAY
                   AND cu.return_at < CURRENT_TIMESTAMP - INTERVAL 24 HOUR) AS yesterdayReturnCnt,
                (SELECT COUNT(*) FROM cycle_claims cc
                 JOIN cycle_usages claim_usage ON claim_usage.cycle_usage_id = cc.cycle_usage_id
                 JOIN cycles c ON c.cycle_id = claim_usage.cycle_id
                 WHERE c.station_id = :stationId AND cc.status = 'READY'
                   AND cc.created_at >= CURRENT_TIMESTAMP - INTERVAL 48 HOUR
                   AND cc.created_at < CURRENT_TIMESTAMP - INTERVAL 24 HOUR) AS yesterdayReportCnt
            """, nativeQuery = true)
    StationDetailStats findStationDetailStats(@Param("stationId") String stationId);

    // 오늘을 제외하고 대여·반납 이벤트를 날짜별로 합산한다.
    @Query(value = """
            SELECT DATE_FORMAT(events.event_date, '%Y-%m-%d') AS date,
                   SUM(events.rental_cnt) AS rentalCnt, SUM(events.return_cnt) AS returnCnt
            FROM (
                SELECT DATE(cu.rental_at) AS event_date, 1 AS rental_cnt, 0 AS return_cnt
                FROM cycle_usages cu WHERE cu.rental_at < CURRENT_DATE
                UNION ALL
                SELECT DATE(cu.return_at) AS event_date, 0 AS rental_cnt, 1 AS return_cnt
                FROM cycle_usages cu WHERE cu.return_at < CURRENT_DATE
            ) events
            WHERE events.event_date >= CASE
                WHEN :term = 'day' THEN CURRENT_DATE - INTERVAL 1 DAY
                WHEN :term = 'week' THEN CURRENT_DATE - INTERVAL 7 DAY
                ELSE CURRENT_DATE - INTERVAL 1 DAY
            END
            GROUP BY events.event_date ORDER BY events.event_date
            """, nativeQuery = true)
    List<StationTrendRow> findStationTrend(@Param("term") String term);
}
