/** 02 온보딩 1of3 · 서비스 소개 */
export function IntroStep() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-8 flex h-56 w-56 items-center justify-center rounded-3xl bg-primary-light">
        <span className="text-sm text-primary">일러스트 영역</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900">
        도착했을 때 탈 수 있는
        <br />
        타슈를 찾아드려요
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-gray-500">
        가장 가까운 대여소가 아니라, 내가 도착하는 시점에 자전거가 남아 있을 대여소를 예측해서
        안내해요.
      </p>
    </div>
  );
}
