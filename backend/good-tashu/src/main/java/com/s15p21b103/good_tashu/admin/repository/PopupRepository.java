package com.s15p21b103.good_tashu.admin.repository;

import com.s15p21b103.good_tashu.admin.domain.PopupEntity;
import com.s15p21b103.good_tashu.admin.dto.res.AdminNoticeListResponse;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PopupRepository extends JpaRepository<PopupEntity, Long> {
    boolean existsByNotice_NoticeId(Long noticeId);

    @EntityGraph(attributePaths = "notice")
    List<PopupEntity> findAllByOrderByCreatedAtDescPopUpIdDesc();

    @Query("""
            select new com.s15p21b103.good_tashu.admin.dto.res.AdminNoticeListResponse(
                n.noticeId, n.title, n.adminEntity.id, n.createdAt, max(p.popUpId)
            )
            from NoticeEntity n
            left join PopupEntity p on p.notice = n
            group by n.noticeId, n.title, n.adminEntity.id, n.createdAt
            order by n.createdAt desc, n.noticeId desc
            """)
    List<AdminNoticeListResponse> findAdminNoticeList();
}
