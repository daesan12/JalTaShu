import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { getMe } from '@/features/auth/api/auth';

export const ME_QUERY_KEY = ['me'] as const;

/**
 * 로그인 상태 조회 훅.
 * - isPending: 확인 중 (스플래시 표시 구간)
 * - isLoggedIn: 세션 있음
 * - needsSignup: 로그인은 됐지만 약관·닉네임 미완료 (nickname null)
 */
export function useAuth() {
  const { data, isPending, error } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      // 401(미로그인)은 정상 상태라 재시도하지 않는다
      if (err instanceof ApiError && err.code === 401) return false;
      return failureCount < 1;
    },
  });

  const isLoggedIn = !!data;
  const needsSignup = isLoggedIn && !data.nickname;

  return { me: data ?? null, isPending, error, isLoggedIn, needsSignup };
}
