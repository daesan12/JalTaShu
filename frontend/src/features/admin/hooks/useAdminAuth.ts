import { useQuery } from '@tanstack/react-query';
import { restoreAdminSession } from '@/features/admin/api/adminAuth';

export const ADMIN_SESSION_QUERY_KEY = ['adminSession'] as const;

/**
 * 관리자 로그인 상태. 백엔드에 me API가 없어 refresh 재발급 성공 여부로 판정한다.
 * 로그인·로그아웃은 재요청 대신 `queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, true|false)`로
 * 바로 반영한다 — refresh를 또 치면 쿠키가 rotation돼 낭비다.
 */
export function useAdminAuth() {
  const { data, isPending } = useQuery({
    queryKey: ADMIN_SESSION_QUERY_KEY,
    // 실패해도 false를 돌려주는 함수라 재시도·에러 처리가 필요 없다
    queryFn: restoreAdminSession,
    staleTime: Infinity,
    retry: false,
  });

  return { isPending, isLoggedIn: data === true };
}
