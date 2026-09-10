/**
 * 이용안내의 나머지 탭 자리표시 — 콘텐츠 확정 후 각각 별도 파일로 구현 예정.
 * (대여·반납 절차, 안전 수칙은 타슈 공식 안내 기준으로 작성할 것)
 */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="px-6 pt-10 text-center">
      <p className="text-sm text-gray-400">{title} 안내 콘텐츠가 들어올 자리입니다.</p>
    </div>
  );
}

export function RentGuideTab() {
  return <Placeholder title="대여" />;
}
export function ReturnGuideTab() {
  return <Placeholder title="반납" />;
}
export function SafetyGuideTab() {
  return <Placeholder title="안전과 약속" />;
}
