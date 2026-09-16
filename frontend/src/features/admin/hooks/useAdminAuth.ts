import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { getAdminMe } from '@/features/admin/api/adminAuth';

export const ADMIN_ME_QUERY_KEY = ['adminMe'] as const;

/**
 * 관리자 로그인 상태 조회. 모바일 useAuth와 같은 모양이지만 쿼리 키와 API가 달라 따로 둔다
 * (관리자 세션과 이용자 세션은 별개다).
 */
export function useAdminAuth() {
  const { data, isPending } = useQuery({
    queryKey: ADMIN_ME_QUERY_KEY,
    queryFn: getAdminMe,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      // 401(미로그인)은 정상 상태라 재시도하지 않는다
      if (err instanceof ApiError && err.code === 401) return false;
      return failureCount < 1;
    },
  });

  return { admin: data ?? null, isPending, isLoggedIn: !!data };
}
