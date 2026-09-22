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

export function resolveNoticePopups(serverNotices: PopupNotice[]): PopupNotice[] {
  return serverNotices.length > 0 ? serverNotices : BUNDLED_NOTICE_POPUPS;
}

/**
 * 관리자가 등록한 팝업이 있으면 서버 목록을 사용한다.
 * 아직 팝업 데이터가 없거나 API가 실패하면 앱에 포함된 기본 5장을 보여 준다.
 */
export async function getNoticePopups(): Promise<PopupNotice[]> {
  try {
    return resolveNoticePopups(await apiGet<PopupNotice[]>('/notice/pop-up'));
  } catch {
    return BUNDLED_NOTICE_POPUPS;
  }
}
