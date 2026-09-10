import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { SplashScreen } from '@/features/auth/components/SplashScreen';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isOnboardingDone } from '@/features/onboarding/lib/onboardingStorage';

/**
 * 메인 화면 진입 가드.
 * 확인 중엔 스플래시(01, 최소 1초) → 온보딩 미완료 → /onboarding,
 * 미로그인 → /login, 가입 미완료 → /signup, 통과 시 하위 라우트 렌더.
 */
export function RequireAuth() {
  const { isPending, isLoggedIn, needsSignup } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isPending || !splashDone) return <SplashScreen />;
  if (!isOnboardingDone()) return <Navigate to="/onboarding" replace />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (needsSignup) return <Navigate to="/signup" replace />;

  return <Outlet />;
}
