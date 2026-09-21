import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { getMe, type Me } from '@/features/auth/api/auth';

export const ME_QUERY_KEY = ['me'] as const;

/**
 * 가입(약관·닉네임) 전 GUEST 상태 — 백엔드 계약상 /users/me가 403이라 이 형태로 해석한다.
 * (nickname null이 needsSignup 판정 기준이라 기존 파생 로직이 그대로 동작한다)
 */
const GUEST_ME: Me = { nickname: null, monthlyMoveCnt: 0, monthlyMoveDis: null, monthlyTime: 0 };

/**
 * 로그인 상태 조회 훅.
 * - isPending: 확인 중 (스플래시 표시 구간)
 * - isLoggedIn: 세션 있음
 * - needsSignup: 로그인은 됐지만 약관·닉네임 미완료 (nickname null)
 */
export function useAuth() {
  const { data, isPending, error } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<Me> => {
      try {
        return await getMe();
      } catch (err) {
        // 백엔드 계약: me의 403 = 유효한 세션인데 GUEST 권한 → 가입(약관 동의) 페이지로
        if (err instanceof ApiError && err.code === 403) return GUEST_ME;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      // 401(미로그인)은 정상 상태라 재시도하지 않는다 (403은 위에서 GUEST로 흡수됨)
      if (err instanceof ApiError && err.code === 401) return false;
      return failureCount < 1;
    },
  });

  const isLoggedIn = !!data;
  const needsSignup = isLoggedIn && !data.nickname;

  return { me: data ?? null, isPending, error, isLoggedIn, needsSignup };
}
