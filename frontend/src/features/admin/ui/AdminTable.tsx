import type { ReactNode } from 'react';

interface AdminTableProps {
  /** 행을 눌러 상세로 들어가는 표 — 행에 커서와 hover 배경을 준다 */
  clickableRows?: boolean;
  children: ReactNode;
}

/**
 * 관리자 목록 표의 공통 껍데기. 컬럼 구성이 화면마다 달라서 thead/tbody는 직접 쓰고,
 * 반복되는 여백·구분선·헤더 글자색만 여기서 준다.
 * 오른쪽 정렬이나 폭 고정 같은 예외는 각 th/td에 className으로 덧붙인다.
 *
 * table-fixed라 폭은 th의 w-* 로 정한다. 폭을 안 준 컬럼끼리는 남은 자리를 똑같이 나눠 갖는다.
 * 칸 안에서 줄바꿈은 막아 둔다(ID·날짜가 두 줄로 쪼개지면 표를 훑기 어렵다).
 * 제보 내용처럼 긴 글이 들어가는 칸에는 td에 `truncate`를 붙여 말줄임으로 자른다.
 */
export function AdminTable({ clickableRows = false, children }: AdminTableProps) {
  return (
    <table
      className={`w-full table-fixed text-sm [&_td]:border-b [&_td]:border-admin-line [&_td]:px-4 [&_td]:py-3 [&_td]:whitespace-nowrap [&_th]:border-b [&_th]:border-admin-line [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-admin-muted [&_tbody_tr:last-child_td]:border-b-0 ${
        clickableRows ? '[&_tbody_tr]:cursor-pointer [&_tbody_tr:hover]:bg-admin-panel' : ''
      }`}
    >
      {children}
    </table>
  );
}
