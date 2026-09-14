package com.s15p21b103.good_tashu.map.repository;

import com.s15p21b103.good_tashu.map.domain.RecentPlaceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Pageable;
import java.util.List;

@Repository
public interface RecentPlaceRepository extends JpaRepository<RecentPlaceEntity, Long> {
    List<RecentPlaceEntity> findByUser_UserIdOrderByCreatedAtDescRecentPlaceIdDesc(Long userId, Pageable pageable);
}
