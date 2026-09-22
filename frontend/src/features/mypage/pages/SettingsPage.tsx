import { useState } from 'react';
import { Chip } from '@/shared/ui/Chip';
import { Toggle } from '@/shared/ui/Toggle';
import { TopHeader } from '@/shared/ui/TopHeader';
import { loadSettings, saveSettings, type AppSettings } from '@/features/mypage/lib/settingsStorage';

const LANGUAGES = ['한국어', 'English', '中文'] as const;

const TERMS_MENUS = [
  '서비스 이용약관',
  '개인정보 수집 및 이용동의',
  '수집된 개인정보의 제3자 정보제공 동의',
  '위치정보 이용동의',
  '개인정보 처리방침',
] as const;

/** 설정 (프로필 메뉴) — 기능설정 + 약관상세 (계정 관련은 프로필에 있어 제외) */
export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="설정" />

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 기능설정 */}
        <h2 className="mt-2 text-sm font-semibold text-gray-400">기능설정</h2>
        <div className="mt-2 divide-y divide-gray-100 rounded-2xl bg-background px-4">
          <div className="flex min-h-15 items-center justify-between">
            <span className="text-[16px] text-gray-900">자동 로그인</span>
            <Toggle
              checked={settings.autoLogin}
              onChange={(checked) => update({ autoLogin: checked })}
              aria-label="자동 로그인"
            />
          </div>
          <div className="flex min-h-15 items-center justify-between">
            <span className="text-[16px] text-gray-900">푸시 수신</span>
            <Toggle
              checked={settings.pushEnabled}
              onChange={(checked) => update({ pushEnabled: checked })}
              aria-label="푸시 수신"
            />
          </div>
        </div>

        {/* 언어설정 */}
        <h2 className="mt-6 text-sm font-semibold text-gray-400">언어설정</h2>
        <div className="mt-2 flex gap-2">
          {LANGUAGES.map((lang) => (
            <Chip
              key={lang}
              selected={lang === '한국어'}
              disabled={lang !== '한국어'}
              className="disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:active:scale-100"
            >
              {lang}
            </Chip>
          ))}
        </div>

        {/* 약관상세 */}
        <h2 className="mt-6 text-sm font-semibold text-gray-400">약관상세</h2>
        <ul className="mt-1 divide-y divide-gray-100">
          {TERMS_MENUS.map((label) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setNotice('약관 본문을 준비 중이에요.')}
                className="flex min-h-14 w-full items-center justify-between text-left text-[16px] text-gray-900 active:bg-gray-50"
              >
                {label}
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300" fill="none">
                  <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {notice && <p className="mt-4 text-center text-sm text-gray-400">{notice}</p>}
      </div>
    </div>
  );
}
