import { Outlet } from 'react-router';

/**
 * 관리자 웹 레이아웃 — 모바일 430px 제약을 적용하지 않는 데스크톱 레이아웃.
 * 이 파일 이하 전체가 별도 청크로 지연 로딩됨 (모바일 사용자는 다운로드하지 않음).
 * TODO: 관리자 인증 가드 추가 (로그인 API 확정 후)
 */
export function AdminLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-gray-200 bg-surface px-6 py-4">
        <h1 className="text-lg font-bold text-gray-900">잘타슈 관리자</h1>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
