/** 01 스플래시 — 인증 확인 중 표시되는 화면 (별도 라우트 아님) */
export function SplashScreen() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-primary">
      <h1 className="text-4xl font-bold text-white">잘타슈</h1>
      <p className="mt-3 text-sm text-white/80">대전광역시 공영자전거</p>
    </div>
  );
}
