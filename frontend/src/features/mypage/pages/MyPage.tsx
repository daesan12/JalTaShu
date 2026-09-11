import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { logout } from '@/features/auth/api/auth';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getMyStats } from '@/features/mypage/api/mypage';
import { NicknameSheet } from '@/features/mypage/components/NicknameSheet';

/** 준비 중 항목은 to 없이 렌더 (25~33 화면 확정 시 연결) */
const MENUS: { label: string; to?: string }[] = [
  { label: '결제수단', to: '/mypage/payments' },
  { label: '이용안내', to: '/mypage/guide' }, // 34
  { label: '자전거 정보', to: '/mypage/bike-info' },
  { label: '고객센터', to: '/mypage/support' },
  { label: '설정', to: '/mypage/settings' },
];

/** 24 프로필 */
export function MyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const [nicknameSheetOpen, setNicknameSheetOpen] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['myStats'], queryFn: getMyStats });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      // 세션·캐시를 비우고 처음부터 (실패해도 클라이언트 상태는 정리)
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-100 px-5 pt-5 pb-4">
        <h1 className="text-[22px] font-bold text-gray-900">프로필</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 닉네임 */}
        <div className="mt-5 flex items-center justify-between">
          <p className="text-3xl font-bold text-gray-900">{me?.nickname ?? '…'}</p>
          <button
            type="button"
            onClick={() => setNicknameSheetOpen(true)}
            className="min-h-10 rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-600 active:bg-gray-50"
          >
            닉네임 변경
          </button>
        </div>

        {/* 이용 통계 */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: '이번 달 이동', value: stats ? `${stats.monthlyRides}회` : '–' },
            { label: '이동 거리', value: stats ? `${stats.distanceKm}km` : '–' },
            { label: '이동 시간', value: stats ? `${stats.durationMin}분` : '–' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl bg-background px-3 py-5 text-center">
              <p className="text-sm text-gray-500">{item.label}</p>
              <p className="tabular-nums mt-1.5 text-xl font-bold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        {/* 메뉴 — "내 제보 내역"은 17-4 내 민원 내역으로 통합되어 제외 */}
        <ul className="mt-4 divide-y divide-gray-100">
          {MENUS.map((menu) => (
            <li key={menu.label}>
              <button
                type="button"
                disabled={!menu.to}
                onClick={() => menu.to && navigate(menu.to)}
                className="flex min-h-15 w-full items-center justify-between text-left text-[17px] text-gray-900 active:bg-gray-50 disabled:text-gray-300"
              >
                <span>
                  {menu.label}
                  {!menu.to && <span className="ml-2 text-xs text-gray-300">준비 중</span>}
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-300" fill="none">
                  <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex min-h-15 w-full items-center text-left text-[17px] text-gray-500 active:bg-gray-50"
            >
              {logoutMutation.isPending ? '로그아웃 중…' : '로그아웃'}
            </button>
          </li>
        </ul>

        {/* 회원 탈퇴 — 백엔드 API 확정 후 연결 */}
        <div className="mt-10 text-center">
          <span className="text-sm text-gray-300 underline underline-offset-2">
            회원 탈퇴 (준비 중)
          </span>
        </div>
      </div>

      <NicknameSheet
        open={nicknameSheetOpen}
        currentNickname={me?.nickname ?? ''}
        onClose={() => setNicknameSheetOpen(false)}
      />
    </div>
  );
}
