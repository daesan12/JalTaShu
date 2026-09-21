import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '@/shared/ui/Button';
import { startKakaoLogin } from '@/features/auth/api/auth';
import { ME_QUERY_KEY, useAuth } from '@/features/auth/hooks/useAuth';

/** 05 로그인 */
export function LoginPage() {
  const { isPending, isLoggedIn, needsSignup } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);

  // 이미 로그인된 상태로 접근하면 다음 단계로
  if (!isPending && isLoggedIn) {
    return <Navigate to={needsSignup ? '/signup' : '/'} replace />;
  }

  const handleKakaoLogin = async () => {
    setLoggingIn(true);
    try {
      const result = await startKakaoLogin();
      // 카카오로 떠나는 중(웹) — 여기서 invalidate·navigate를 하면 브라우저가 대기 중인
      // 카카오 이동을 취소한다. 버튼은 '로그인 중…'인 채로 페이지가 넘어갈 때까지 둔다
      if (result === 'redirecting') return;
      // 인앱 로그인 창을 직접 닫음 — 로그인 화면으로 복귀
      if (result === 'cancelled') {
        setLoggingIn(false);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      navigate('/', { replace: true });
    } catch {
      setLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-6">
      {/* 로고 영역 */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary">
          <span className="text-2xl font-bold text-white">잘타슈</span>
        </div>
        <p className="mt-4 text-[15px] text-gray-500">대전 자전거 여정 내비게이션</p>
      </div>

      {/* 하단: 카카오 로그인 */}
      <div className="pb-safe pb-8">
        <Button full variant="kakao" onClick={handleKakaoLogin} disabled={loggingIn}>
          <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M12 4C7.03 4 3 7.13 3 11c0 2.47 1.64 4.64 4.1 5.88l-.83 3.07c-.07.28.24.5.48.34l3.62-2.4c.53.07 1.07.11 1.63.11 4.97 0 9-3.13 9-7S16.97 4 12 4Z" />
          </svg>
          {loggingIn ? '로그인 중…' : '카카오로 시작하기'}
        </Button>
        <p className="mt-4 text-center text-xs leading-relaxed text-gray-400">
          로그인하면 서비스 이용약관과 개인정보 처리방침에
          <br />
          동의한 것으로 봅니다.
        </p>
      </div>
    </div>
  );
}
