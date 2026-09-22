import logoWordmark from '@/assets/brand/logo-wordmark.png';

/** 인증 상태를 확인하는 동안 웹과 Android에서 공통으로 보여 주는 브랜드 화면 */
export function SplashScreen() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-white px-8">
      <img
        src={logoWordmark}
        alt="잘타슈"
        width={1200}
        height={401}
        className="h-auto w-full max-w-[320px]"
      />
      <p className="mt-5 text-sm font-medium tracking-[0.08em] text-muted">
        대전광역시 공영자전거
      </p>
    </div>
  );
}
