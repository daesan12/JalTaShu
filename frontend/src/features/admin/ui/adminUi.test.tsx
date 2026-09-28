// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdminFieldLabel } from '@/features/admin/ui/AdminField';
import { AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';
import { formatUserCells } from '@/features/admin/lib/format';

/** 관리자 공통 컴포넌트의 분기(증감 색·표 상태·카운터·페이지 버튼)를 잠그는 렌더 테스트 */

afterEach(cleanup);

describe('AdminStatCard', () => {
  it('증감이 있으면 부호에 따라 색을 바꿔 "어제 대비"를 보여준다', () => {
    render(<AdminStatCard label="오늘 대여" value="12건" delta={3} />);
    expect(screen.getByText('어제 대비 +3건')).toHaveProperty('className');
    expect(screen.getByText('어제 대비 +3건').className).toContain('text-admin-ok-text');

    render(<AdminStatCard label="오늘 반납" value="8건" delta={-2} />);
    expect(screen.getByText('어제 대비 -2건').className).toContain('text-admin-danger-text');

    render(<AdminStatCard label="변화 없음" value="5건" delta={0} />);
    expect(screen.getByText('어제 대비 0건').className).toContain('text-admin-muted');
  });

  it('증감이 없으면 보조 문구를, 그것도 없으면 값만 보여준다', () => {
    render(<AdminStatCard label="배치 자전거" value="7대" sub="거치대 10개" />);
    expect(screen.getByText('거치대 10개')).toBeTruthy();

    render(<AdminStatCard label="누적 이용" value="42회" valueClass="text-admin-warn-text" />);
    expect(screen.getByText('42회').className).toContain('text-admin-warn-text');
    expect(screen.queryByText(/어제 대비/)).toBeNull();
  });
});

describe('AdminTableStatus', () => {
  function renderInTable(ui: React.ReactNode) {
    return render(
      <table>
        <tbody>{ui}</tbody>
      </table>,
    );
  }

  it('로딩 > 실패 > 빈 목록 순서로 하나만 보여준다', () => {
    renderInTable(<AdminTableStatus colSpan={4} isPending isError isEmpty emptyText="없습니다" />);
    expect(screen.getByText('불러오는 중…')).toBeTruthy();
    expect(screen.queryByText('없습니다')).toBeNull();
  });

  it('실패면 다시 시도 버튼이 onRetry를 부른다', () => {
    const onRetry = vi.fn();
    renderInTable(
      <AdminTableStatus
        colSpan={4}
        isPending={false}
        isError
        onRetry={onRetry}
        isEmpty={false}
        emptyText="없습니다"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('빈 목록이면 문구를, 데이터가 있으면 아무것도 그리지 않는다', () => {
    renderInTable(
      <AdminTableStatus colSpan={4} isPending={false} isEmpty emptyText="표시할 공지가 없습니다" />,
    );
    expect(screen.getByText('표시할 공지가 없습니다')).toBeTruthy();

    const { container } = renderInTable(
      <AdminTableStatus colSpan={4} isPending={false} isEmpty={false} emptyText="없습니다" />,
    );
    expect(container.querySelectorAll('tr')).toHaveLength(0);
  });

  it('보여줄 행이 남아 있으면 실패 문구가 목록이 비었다고 말하지 않는다', () => {
    // 재조회만 실패한 경우 — 직전 데이터가 남아 있어 표에는 행이 그려진다
    renderInTable(
      <AdminTableStatus
        colSpan={4}
        isPending={false}
        isError
        isEmpty={false}
        emptyText="없습니다"
      />,
    );
    expect(screen.getByText(/이전 내용을 보여줍니다/)).toBeTruthy();
    expect(screen.queryByText(/목록을 불러오지 못했습니다/)).toBeNull();
  });

  it('보여줄 행이 없으면 못 불러왔다고 말한다', () => {
    renderInTable(
      <AdminTableStatus colSpan={4} isPending={false} isError isEmpty emptyText="없습니다" />,
    );
    expect(screen.getByText(/목록을 불러오지 못했습니다/)).toBeTruthy();
  });
});

describe('formatUserCells', () => {
  it('닉네임과 사용자 ID를 두 칸으로 나누고 없는 값은 "-"로 둔다', () => {
    expect(formatUserCells('조용한산책366', 315)).toEqual({
      nickname: '조용한산책366',
      userCode: 'U-000315',
    });
    // 가입 전 GUEST — 이용 이력·제보에는 나오지 않지만 API 타입상 대비
    expect(formatUserCells(null, 7)).toEqual({ nickname: '-', userCode: 'U-000007' });
    // 앱을 거치지 않은 이용 이력 — 가리킬 사람이 없다
    expect(formatUserCells(null, null)).toEqual({ nickname: '-', userCode: '-' });
  });
});

describe('AdminFieldLabel', () => {
  it('count·max를 주면 카운터가 붙고 없으면 라벨만 나온다', () => {
    render(<AdminFieldLabel label="사유" count={12} max={100} />);
    expect(screen.getByText('12/100')).toBeTruthy();

    const { container } = render(<AdminFieldLabel label="처리 내용" />);
    expect(screen.getByText('처리 내용')).toBeTruthy();
    // 카운터 span은 라벨 span 하나만 있을 때 생기지 않는다
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });
});

describe('AdminPagination', () => {
  it('현재 페이지에 aria-current가 붙고 번호를 누르면 onChange가 온다', () => {
    const onChange = vi.fn();
    render(<AdminPagination page={2} pageSize={12} totalCount={60} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '2' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('첫 페이지에서 이전이, 끝 페이지에서 다음이 비활성화된다', () => {
    render(<AdminPagination page={1} pageSize={12} totalCount={60} onChange={() => {}} />);
    expect(
      (screen.getByRole('button', { name: '이전 페이지' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: '다음 페이지' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('0건이면 안내 문구를 보여준다', () => {
    render(<AdminPagination page={1} pageSize={12} totalCount={0} onChange={() => {}} />);
    expect(screen.getByText('표시할 내용이 없습니다')).toBeTruthy();
  });
});
