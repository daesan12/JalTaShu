/**
 * 네이버 지도가 들어갈 자리.
 * 클라이언트 ID 발급 전까지 회색 영역으로 두고, 지도 연동 이슈에서 실제 지도로 교체한다.
 */
export function MapPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
      <p className="px-8 text-center text-sm text-gray-500">
        지도가 들어갈 자리입니다.
        <br />
        네이버 지도 키 발급 후 연결됩니다.
      </p>
    </div>
  );
}
