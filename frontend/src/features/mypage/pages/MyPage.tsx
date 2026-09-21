import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { logout } from '@/features/auth/api/auth';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { NicknameSheet } from '@/features/mypage/components/NicknameSheet';

const SERVICE_MENUS = [
  { label: '결제수단', description: '등록한 결제수단 관리', to: '/mypage/payments', icon: 'card' },
  { label: '이용안내', description: '대여부터 반납까지', to: '/mypage/guide', icon: 'guide' },
  {
    label: '자전거 정보',
    description: '타슈 이용 정보 확인',
    to: '/mypage/bike-info',
    icon: 'bike',
  },
] as const;

const SUPPORT_MENUS = [
  { label: '고객센터', description: 'FAQ와 문의 안내', to: '/mypage/support', icon: 'help' },
  { label: '설정', description: '알림과 앱 설정', to: '/mypage/settings', icon: 'settings' },
] as const;

function MenuIcon({ name }: { name: string }) {
  const common = 'h-5 w-5';
  if (name === 'card')
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  if (name === 'guide')
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden>
        <path
          d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M8 20V8h9" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  if (name === 'bike')
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden>
        <circle cx="6.5" cy="16.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="16.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m6.5 16.5 4-7 3 7m-5-4h7l-2-5h-3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (name === 'help')
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9.5 9a2.6 2.6 0 1 1 4.2 2c-1 .8-1.7 1.2-1.7 2.5M12 17h.01"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4L17 7M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuGroup({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: readonly { label: string; description: string; to: string; icon: string }[];
  onOpen: (to: string) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="px-1 text-sm font-bold text-muted">{title}</h2>
      <ul className="mt-2 overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_7px_22px_rgba(42,60,34,0.045)]">
        {items.map((menu, index) => (
          <li key={menu.label} className={index > 0 ? 'border-t border-line' : ''}>
            <button
              type="button"
              onClick={() => onOpen(menu.to)}
              className="group flex min-h-18 w-full items-center gap-3.5 px-4 text-left transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset active:bg-primary-light motion-reduce:transition-none"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary-light text-primary">
                <MenuIcon name={menu.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-ink">{menu.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{menu.description}</span>
              </span>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 shrink-0 text-gray-300 transition-transform duration-150 group-hover:translate-x-0.5 group-active:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                fill="none"
                aria-hidden
              >
                <path
                  d="m9 5 7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const [nicknameSheetOpen, setNicknameSheetOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  const nickname = me?.nickname ?? '…';

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_90%_3%,rgba(124,173,69,0.12),transparent_30%),var(--color-canvas)]">
      <header className="px-5 pt-5 pb-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-primary">MY TASHU</p>
        <h1 className="mt-1 text-[24px] font-extrabold text-ink">마이페이지</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <section className="relative mt-3 overflow-hidden rounded-[28px] border border-line/80 bg-[radial-gradient(circle_at_91%_10%,rgba(124,173,69,0.24),transparent_34%),linear-gradient(135deg,#ffffff,#fbfdf8)] p-5 text-ink shadow-[0_16px_36px_rgba(42,60,34,0.1)]">
          <span
            aria-hidden
            className="absolute -top-12 -right-10 h-36 w-36 rounded-full border-[22px] border-primary/6"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">반가워요</p>
              <p className="mt-0.5 truncate text-[24px] font-extrabold">{nickname}</p>
            </div>
            <button
              type="button"
              onClick={() => setNicknameSheetOpen(true)}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-white/75 px-3.5 text-sm font-semibold text-primary shadow-sm transition-[background-color,border-color,transform] duration-150 hover:border-primary/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                <path
                  d="m4 16-.8 4 4-.8L18.4 8a2.1 2.1 0 0 0-3-3L4 16Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="m13.8 6.6 3.6 3.6" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              닉네임 변경
            </button>
          </div>

          <div className="relative mt-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line/80 bg-surface-soft/75 px-1 py-3.5">
            {[
              { label: '이번 달 이동', value: me ? `${me.monthlyMoveCnt}회` : '–' },
              { label: '이동 거리', value: me ? `${(me.monthlyMoveDis ?? 0).toFixed(1)}km` : '–' },
              { label: '자전거 시간', value: me ? `${me.monthlyTime}분` : '–' },
            ].map((item) => (
              <div key={item.label} className="px-2 text-center first:pl-0 last:pr-0">
                <p className="text-[11px] text-muted">{item.label}</p>
                <p className="tabular-nums mt-1 text-[17px] font-extrabold text-ink">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <MenuGroup title="서비스" items={SERVICE_MENUS} onOpen={navigate} />
        <MenuGroup title="도움 및 설정" items={SUPPORT_MENUS} onOpen={navigate} />

        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="mt-5 min-h-13 w-full rounded-2xl border border-line bg-surface text-[15px] font-semibold text-muted transition-[background-color,color,transform] duration-150 hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.99] disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
        >
          {logoutMutation.isPending ? '로그아웃 중…' : '로그아웃'}
        </button>
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => navigate('/mypage/withdraw')}
            className="min-h-11 rounded-lg px-3 text-sm text-gray-400 underline underline-offset-2 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:text-gray-600"
          >
            회원 탈퇴
          </button>
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
