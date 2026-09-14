package com.s15p21b103.good_tashu.notice.repository;

import com.s15p21b103.good_tashu.notice.domain.NoticeEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NoticeRepository extends JpaRepository<NoticeEntity, Long> {
    @EntityGraph(attributePaths = "adminEntity")
    List<NoticeEntity> findAllByOrderByCreatedAtDescNoticeIdDesc();

    @Override
    @EntityGraph(attributePaths = "adminEntity")
    Optional<NoticeEntity> findById(Long noticeId);

    @Modifying
    @Query("update NoticeEntity n set n.viewCount = coalesce(n.viewCount, 0) + 1 where n.noticeId = :noticeId")
    int incrementViewCount(@Param("noticeId") Long noticeId);
}
