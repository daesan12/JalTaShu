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
    stationStrategy: 'NEAREST',
    totalSec: 1_200,
    totalDistanceM: 4_800,
    walkSec: 240,
    ascentM: 61,
    expectedBikeCnt: 3,
  },
  {
    index: 1,
    type: 'UPHILL',
    stationStrategy: 'NEAREST',
    totalSec: 1_320,
    totalDistanceM: 5_100,
    walkSec: 300,
    ascentM: 24,
    expectedBikeCnt: 3,
  },
  {
    index: 2,
    type: 'BIKE',
    stationStrategy: 'BIKE_SECURE',
    totalSec: 1_380,
    totalDistanceM: 5_300,
    walkSec: 360,
    ascentM: 65,
    expectedBikeCnt: 6,
  },
  {
    index: 3,
    type: 'UPHILL',
    stationStrategy: 'BIKE_SECURE',
    totalSec: 1_500,
    totalDistanceM: 5_600,
    walkSec: 360,
    ascentM: 26,
    expectedBikeCnt: 6,
  },
];

function Harness({
  onStart = () => undefined,
  onOpenDetail = () => undefined,
}: {
  onStart?: (index: number) => void;
  onOpenDetail?: (index: number) => void;
}) {
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
      onOpenDetail={onOpenDetail}
      onStart={onStart}
      showToast={() => undefined}
    />
  );
}

describe('RouteCompareSheet', () => {
  it('일반·오르막 적은·확보 우선 조합의 네 경로와 공통 안내 버튼을 보여준다', () => {
    render(<Harness />);

    expect(screen.getByText('경로 비교')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '이 경로로 안내 시작' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^일반 경로/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^확보 우선 일반 경로/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^확보 우선 오르막 적은 경로/ })).toBeTruthy();
  });

  it('카드 선택은 안내를 시작하지 않고 공통 버튼이 선택된 경로를 한 번 시작한다', () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);

    fireEvent.click(screen.getByRole('button', { name: /^오르막 적은 경로/ }));
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '이 경로로 안내 시작' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(1);
  });

  // 카드 탭은 "고르기", 고른 카드를 다시 누르면 "자세히 보기" — 안내 시작은 아래 고정 버튼만 한다
  it('고르지 않은 카드를 누르면 선택만 하고 상세로 가지 않는다', () => {
    const onOpenDetail = vi.fn();
    render(<Harness onOpenDetail={onOpenDetail} />);

    fireEvent.click(screen.getByRole('button', { name: /^오르막 적은 경로/ }));
    expect(onOpenDetail).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /^오르막 적은 경로/ }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('이미 고른 카드를 다시 누르면 상세를 연다', () => {
    const onOpenDetail = vi.fn();
    const onStart = vi.fn();
    render(<Harness onOpenDetail={onOpenDetail} onStart={onStart} />);

    // 처음부터 선택돼 있는 카드(일반 경로)를 한 번 누른다
    fireEvent.click(screen.getByRole('button', { name: /^일반 경로/ }));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).toHaveBeenCalledWith(0);
    // 상세로 가는 것이지 안내가 시작되면 안 된다
    expect(onStart).not.toHaveBeenCalled();
  });
});
