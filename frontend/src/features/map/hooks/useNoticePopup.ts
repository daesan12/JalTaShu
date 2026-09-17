import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { NOTICE_POPUPS_QUERY_KEY, getNoticePopups } from '@/features/map/api/noticePopups';
import { NOTICES_PATH } from '@/features/map/lib/noticeLink';
import {
  hideNoticePopupForWeek,
  isNoticePopupHidden,
  markNoticePopupClosed,
} from '@/features/map/lib/noticePopupHide';

/**
 * 07-1 공지 팝업 — 한 번 닫으면 앱을 다시 켜기 전까지 뜨지 않는다.
 * "7일간 보지 않기"는 저장소로 더 오래 막는다. 닫힘 기억은 모듈(noticePopupHide)에 있고,
 * 이 훅의 state는 화면을 다시 그리는 용도다.
 */
export function useNoticePopup() {
  const navigate = useNavigate();
  const [closed, setClosed] = useState(isNoticePopupHidden);

  // 이미 숨긴 상태면 요청 자체를 하지 않는다
  const { data: notices } = useQuery({
    queryKey: NOTICE_POPUPS_QUERY_KEY,
    queryFn: getNoticePopups,
    enabled: !closed,
  });

  function close() {
    markNoticePopupClosed();
    setClosed(true);
  }

  function closeForWeek() {
    hideNoticePopupForWeek();
    close();
  }

  // 공지 상세 화면이 아직 없어 연결된 공지 번호와 상관없이 목록으로 보낸다
  function openNotice() {
    close();
    navigate(NOTICES_PATH);
  }

  return { closed, notices, close, closeForWeek, openNotice };
}
