import { Link, useRouteError } from 'react-router';

/**
 * 라우터 전역 에러 화면 — 렌더 중 예외·lazy 청크 로드 실패가 앱 전체를
 * 흰 화면(React Router 기본 스택 트레이스)으로 만들지 않게 받아낸다.
 * 모바일·관리자 공용이라 특정 파트 컴포넌트 없이 중립 스타일로 둔다.
 */

/** 배포 직후 구 청크 해시를 잡고 있던 세션의 동적 import 실패 — 새로고침이 정답인 오류 */
function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Loading chunk|Importing a module script failed/i.test(
      error.message,
    )
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  const stale = isChunkLoadError(error);

  return (
    <ErrorShell
      title={stale ? '새 버전이 배포되었어요' : '문제가 발생했어요'}
      description={
        stale
          ? '화면을 새로고침하면 최신 버전으로 이어서 사용할 수 있습니다.'
          : '일시적인 오류일 수 있어요. 새로고침해 보시고, 계속되면 처음 화면에서 다시 시도해 주세요.'
      }
    >
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-12 rounded-xl bg-primary px-6 text-base font-semibold text-white"
      >
        새로고침
      </button>
      <HomeLink />
    </ErrorShell>
  );
}

/** 등록되지 않은 경로 (path: '*') */
export function NotFoundPage() {
  return (
    <ErrorShell
      title="페이지를 찾을 수 없어요"
      description="주소가 잘못되었거나 삭제된 페이지입니다."
    >
      <HomeLink primary />
    </ErrorShell>
  );
}

function ErrorShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-8 text-center">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <p className="text-sm leading-relaxed text-gray-500">{description}</p>
      <div className="mt-4 flex flex-col items-stretch gap-2">{children}</div>
    </div>
  );
}

function HomeLink({ primary = false }: { primary?: boolean }) {
  return (
    <Link
      to="/"
      className={`inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-base font-semibold ${
        primary
          ? 'bg-primary text-white'
          : 'border border-gray-200 bg-surface text-gray-700'
      }`}
    >
      처음 화면으로
    </Link>
  );
}
