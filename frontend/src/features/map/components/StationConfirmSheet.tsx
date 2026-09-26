import { useMemo, useState } from 'react';
import type { BikeStation } from '@/shared/api/types';
import { haversineMeters, posToLatLng } from '@/shared/lib/coords';
import { formatDistance } from '@/shared/lib/format';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { InputField } from '@/shared/ui/InputField';
import {
  toChoice,
  type PendingStationAction,
  type StationChoice,
} from '@/features/map/hooks/useCycleRental';

/** 다른 대여소 목록에 보여 줄 개수 — 가까운 순으로 이만큼이면 걸어서 갈 만한 곳은 다 들어온다 */
const PICK_LIMIT = 30;

const KIND_TEXT = {
  rent: { verb: '대여', question: '에서 대여할까요?' },
  return: { verb: '반납', question: '에 반납할까요?' },
} as const;

interface StationConfirmSheetProps {
  /** 확인할 대여·반납. null이면 닫힌다 */
  action: PendingStationAction | null;
  /** 다른 대여소 목록의 재료 */
  stations: BikeStation[] | undefined;
  busy: boolean;
  onConfirm: (station: StationChoice) => void;
  onCancel: () => void;
}

/**
 * 대여·반납 대여소 확인(#145).
 *
 * 먼저 권하는 대여소 하나를 묻고(`확인`), 아니면 다른 대여소를 고르게 한다(`고르기`).
 * 안내에서 정한 대여소가 아닌 곳에서 빌리거나 반납하고 떠날 수도 있어서다.
 * 목록은 가까운 순이고 이름으로 찾을 수 있다. 거리 기준은 지금 위치, 위치를 모르면 권한 대여소다 —
 * GPS가 틀려도 시연장 근처 대여소가 위에 오게 한다.
 */
export function StationConfirmSheet({
  action,
  stations,
  busy,
  onConfirm,
  onCancel,
}: StationConfirmSheetProps) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const origin = useMemo(() => {
    if (action === null) return null;
    return action.position === null
      ? { lat: action.suggested.lat, lng: action.suggested.lng }
      : posToLatLng(action.position);
  }, [action]);

  const choices = useMemo(() => {
    if (!picking || origin === null || !stations) return [];
    const keyword = query.trim();
    return stations
      .filter((s) => keyword === '' || s.name.includes(keyword))
      .map((s) => ({ station: s, distanceM: haversineMeters(origin, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, PICK_LIMIT);
  }, [picking, origin, stations, query]);

  function close() {
    setPicking(false);
    setQuery('');
    onCancel();
  }

  function confirm(station: StationChoice) {
    setPicking(false);
    setQuery('');
    onConfirm(station);
  }

  const text = action === null ? KIND_TEXT.return : KIND_TEXT[action.kind];

  return (
    <BottomSheet
      open={action !== null}
      snapPoint={picking ? 'tall' : 'mini'}
      onClose={close}
      backdrop
    >
      {action === null ? null : picking ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="뒤로"
              onClick={() => setPicking(false)}
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 transition-[background-color] duration-75 active:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                <path
                  d="m15 5-7 7 7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <p className="text-lg font-semibold text-gray-900">{text.verb}할 대여소 선택</p>
          </div>
          <InputField
            className="mt-2"
            placeholder="대여소 이름으로 찾기"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
          />
          <ul className="mt-2 min-h-0 flex-1 overflow-y-auto pb-3">
            {choices.map(({ station, distanceM }) => (
              <li key={station.stationId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirm(toChoice(station))}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-2 text-left transition-[background-color] duration-75 active:bg-gray-100 disabled:opacity-40"
                >
                  <span className="min-w-0 truncate text-[15px] font-medium text-gray-900">
                    {station.name}
                  </span>
                  <span className="shrink-0 text-sm text-gray-500 tabular-nums">
                    {formatDistance(distanceM)}
                  </span>
                </button>
              </li>
            ))}
            {choices.length === 0 ? (
              <li className="py-6 text-center text-sm text-gray-500">찾는 대여소가 없습니다.</li>
            ) : null}
          </ul>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <p className="text-sm text-gray-500">{action.cycleId} 자전거</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            <span className="text-primary">{action.suggested.name}</span>
            {text.question}
          </p>
          <div className="mt-auto flex gap-2 pb-3">
            <Button
              variant="line"
              className="flex-1"
              disabled={busy}
              onClick={() => setPicking(true)}
            >
              다른 대여소
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => confirm(action.suggested)}>
              {busy ? `${text.verb}하는 중…` : `${text.verb}하기`}
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
