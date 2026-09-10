const PERMISSIONS = [
  {
    name: '위치',
    required: true,
    description: '내 주변 대여소와 도보 경로를 계산하는 데 사용해요',
  },
  {
    name: '카메라',
    required: true,
    description: '자전거 QR코드를 스캔할 때만 사용해요',
  },
  {
    name: '알림',
    required: false,
    description: '대여소 고갈 위험이 커지면 알려드려요',
  },
] as const;

/** 03 온보딩 2of3 · 권한 안내 */
export function PermissionStep() {
  return (
    <div className="flex flex-1 flex-col justify-center px-6">
      <h2 className="text-xl font-bold text-gray-900">
        원활한 이용을 위해
        <br />
        권한을 허용해 주세요
      </h2>
      <ul className="mt-8 space-y-4">
        {PERMISSIONS.map((p) => (
          <li key={p.name} className="rounded-2xl bg-background p-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{p.name}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                  p.required ? 'bg-primary-light text-primary' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.required ? '필수' : '선택'}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">{p.description}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-gray-400">
        알림은 선택이며, 거부해도 서비스를 이용할 수 있어요.
      </p>
    </div>
  );
}
