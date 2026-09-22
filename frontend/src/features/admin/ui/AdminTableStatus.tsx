interface AdminTableStatusProps {
  /** 표의 컬럼 수 — 상태 문구 행이 전체 폭을 차지하게 한다 */
  colSpan: number;
  isPending: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** 로딩·오류가 아닌데 보여줄 행이 없는 경우 */
  isEmpty: boolean;
  emptyText: string;
}

/**
 * 목록 표 tbody 맨 앞에 넣는 상태 행 — 로딩·실패·빈 목록을 한 곳에서 처리한다.
 * 정상일 때는 아무것도 그리지 않으므로 데이터 map 앞에 그냥 두면 된다.
 *
 * 실패는 보여줄 행이 있는지에 따라 뜻이 달라진다(`isEmpty`로 구분한다).
 * 아예 못 받은 것과, 갱신만 실패해 이전 내용이 남은 것은 다른 상황이다.
 */
export function AdminTableStatus({
  colSpan,
  isPending,
  isError = false,
  onRetry,
  isEmpty,
  emptyText,
}: AdminTableStatusProps) {
  if (isPending) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center text-admin-muted">
          불러오는 중…
        </td>
      </tr>
    );
  }
  if (isError) {
    // 재조회만 실패하면 react-query가 직전 데이터를 그대로 들고 있어 행이 남는다.
    // 그때 "불러오지 못했습니다"를 띄우면 목록이 보이는데 실패했다는 앞뒤 안 맞는 화면이 된다.
    return (
      <tr>
        <td colSpan={colSpan} className="text-center">
          <span className="text-admin-muted">
            {isEmpty
              ? '목록을 불러오지 못했습니다. '
              : '최신 목록을 불러오지 못해 이전 내용을 보여줍니다. '}
          </span>
          {onRetry && (
            <button type="button" className="text-admin-text underline" onClick={onRetry}>
              다시 시도
            </button>
          )}
        </td>
      </tr>
    );
  }
  if (isEmpty) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center text-admin-muted">
          {emptyText}
        </td>
      </tr>
    );
  }
  return null;
}
