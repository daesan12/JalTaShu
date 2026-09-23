import { apiGet } from '@/shared/api/client';

/**
 * 07-1 공지 팝업 한 장 — 백엔드 `PopupListResponse` 실측 스키마.
 *
 * 마이페이지 공지사항 목록(`/notice/list`)과는 **별개 데이터**다. 관리자가 팝업을 따로 등록하고,
 * 등록할 때 공지 하나를 반드시 연결한다(백엔드 `PopupEntity.notice`가 not null).
 */
export interface PopupNotice {
  /** 팝업 제목 — 화면에는 이미지만 보이므로 이미지 대체 텍스트로 쓴다 */
  title: string;
  /** 팝업에 띄울 이미지. 백엔드 URL 또는 앱과 함께 배포한 정적 파일 경로다. */
  photoUrl: string;
  /** 눌렀을 때 열 공지. 팝업은 항상 공지에 연결돼 있다 */
  noticeId: number;
}

export const NOTICE_POPUPS_QUERY_KEY = ['notice', 'pop-up'] as const;

function bundledImage(fileName: string): string {
  return `${import.meta.env.BASE_URL}notices/${fileName}`;
}

/**
 * 서비스에 기본으로 포함하는 공지 5장.
 * `public` 파일이라 frontend 이미지와 함께 배포되며 staging의 `/staging/` base path도 따른다.
 * 같은 이미지를 관리자 화면에서 공지 1~5번에 핀으로 올려 서버 팝업으로도 쓴다.
 */
export const BUNDLED_NOTICE_POPUPS: PopupNotice[] = [
  {
    title: '임시 폐쇄 대여소 안내',
    photoUrl: bundledImage('notice-01-temporary-closure.jpg'),
    noticeId: 5,
  },
  {
    title: '공공 데이터 활용 설문조사',
    photoUrl: bundledImage('notice-02-public-data-survey.jpg'),
    noticeId: 4,
  },
  {
    title: '이용약관 개정 알림',
    photoUrl: bundledImage('notice-03-terms-update.jpg'),
    noticeId: 3,
  },
  {
    title: '안전수칙 확인 절차 개선',
    photoUrl: bundledImage('notice-04-safety-check.jpg'),
    noticeId: 2,
  },
  {
    title: '대여소 반납 안내',
    photoUrl: bundledImage('notice-05-return-check.jpg'),
    noticeId: 1,
  },
];

/**
 * 팝업은 관리자 화면의 핀 상태를 그대로 따른다 — 서버 목록이 비어 있으면(핀이 모두 꺼짐) 띄우지 않는다.
 * 비었을 때 기본 5장으로 채우면 관리자가 핀을 다 꺼도 앱에는 계속 떠서 두 화면이 어긋난다.
 * 기본 5장은 API 자체가 실패했을 때만 쓴다.
 */
export async function getNoticePopups(): Promise<PopupNotice[]> {
  try {
    return await apiGet<PopupNotice[]>('/notice/pop-up');
  } catch {
    return BUNDLED_NOTICE_POPUPS;
  }
}
