// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouteCompareSheet } from '@/features/map/components/RouteCompareSheet';
import type { RouteSummary } from '@/features/map/lib/routeMetrics';

afterEach(cleanup);

const summaries: RouteSummary[] = [
  {
    index: 0,
    type: 'BIKE',
    totalSec: 1_200,
    totalDistanceM: 4_800,
    walkSec: 240,
    ascentM: 61,
    expectedBikeCnt: 3,
  },
  {
    index: 1,
    type: 'UPHILL',
    totalSec: 1_320,
    totalDistanceM: 5_100,
    walkSec: 300,
    ascentM: 24,
    expectedBikeCnt: 3,
  },
];

function Harness({ onStart }: { onStart: (index: number) => void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  return (
    <RouteCompareSheet
      open
      snap="half"
      onSnapChange={() => undefined}
      summaries={summaries}
      fetchedAt={Date.UTC(2026, 8, 21, 0, 0)}
      sort={[]}
      onSortChange={() => undefined}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      onStart={onStart}
      showToast={() => undefined}
    />
  );
}

describe('RouteCompareSheet', () => {
  it('두 경로 카드와 공통 안내 시작 버튼 하나만 보여준다', () => {
    render(<Harness onStart={() => undefined} />);

    expect(screen.getByText('경로 비교')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '이 경로로 안내 시작' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /일반/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('카드 선택은 안내를 시작하지 않고 공통 버튼이 선택된 경로를 한 번 시작한다', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: /오르막 적은 경로/ }));
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '이 경로로 안내 시작' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(1);
  });
});
