package com.s15p21b103.good_tashu.admin.repository;

import com.s15p21b103.good_tashu.admin.domain.PopupEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PopupRepository extends JpaRepository<PopupEntity, Long> {
    boolean existsByNotice_NoticeId(Long noticeId);
}
