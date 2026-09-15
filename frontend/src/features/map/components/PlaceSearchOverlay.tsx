import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import type { PlaceSearchResult, Pos } from '@/shared/api/types';
import { haversineMeters, posToLatLng } from '@/shared/lib/coords';
import { Chip } from '@/shared/ui/Chip';
import {
  RECENT_PLACES_QUERY_KEY,
  dedupePlaces,
  deleteRecentPlace,
  getRecentPlaces,
  placeSearchQueryKey,
  saveRecentPlace,
  searchPlaces,
  type DedupedRecentPlace,
} from '@/features/map/api/places';
import { PlaceRow } from '@/features/map/components/PlaceRow';

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

function placeKey(place: PlaceSearchResult) {
  return `${place.title}|${place.xPos}|${place.yPos}`;
}

interface PlaceSearchOverlayProps {
  onClose: () => void;
  /** 결과·최근 검색에서 장소를 고르면 호출(현재 field 기준). 최근 검색 저장은 이 컴포넌트가 처리한다 */
  onSelect: (place: PlaceSearchResult) => void;
  /** 현재 위치 — 결과까지의 직선거리를 보여주는 데 쓴다. 모르면 null */
  currentLocation: Pos | null;
  /** 위치를 다시 조회한다("내 위치" 칩). 실패 안내는 페이지가 띄운다 */
  onRefreshLocation: () => void;
  /** 위치 조회 중 — 문구를 바꾼다 */
  locationLoading: boolean;
  /** "지도에서 선택" — 오버레이를 닫고 지도 선택 모드로 넘어간다(현재 field 기준) */
  onPickOnMap: () => void;
  /** 최근 검색 삭제 실패 안내 */
  showToast: (text: string) => void;
  /**
   * 'destination'(기본) — 목적지를 고르는 원래 화면. 위에 출발지 줄 + 바꾸기 버튼이 있다.
   * 'start' — 출발지를 고르는 중첩 화면(출발지 줄을 눌러 들어옴). 헤더·칩 문구가 달라진다.
   */
  field?: 'start' | 'destination';
  /** field==='destination'일 때 출발지 줄에 보여줄 이름("현재 위치" 또는 고른 장소 이름) */
  startLabel: string;
  /** field==='destination'일 때 출발지 줄을 누르면 — 출발지 고르는 화면으로 이동 */
  onEditStart: () => void;
  /** field==='destination'일 때 바꾸기(↕) 버튼 — 출발지·목적지를 서로 맞바꾼다 */
  onSwap: () => void;
  /** field==='start'일 때 "현재 위치 사용" — 고른 출발지를 지우고 자동(현재 위치)으로 되돌린다 */
  onUseCurrentLocationAsStart: () => void;
}

/**
 * 08 장소 검색 — 07 위에 얹는 전체 화면 오버레이(새 라우트 없음: 지도 재생성 방지).
 * 검색은 엔터/검색 버튼으로 한 번만 실행한다(글자마다 자동 검색하면 네이버 API 호출이 늘어난다).
 */
export function PlaceSearchOverlay({
  onClose,
  onSelect,
  currentLocation,
  onRefreshLocation,
  locationLoading,
  onPickOnMap,
  showToast,
  field = 'destination',
  startLabel,
  onEditStart,
  onSwap,
  onUseCurrentLocationAsStart,
}: PlaceSearchOverlayProps) {
  const isStartMode = field === 'start';
  const [input, setInput] = useState('');
  // 실제로 검색을 실행한 검색어. 입력 중인 글자와 분리해 결과가 흔들리지 않게 한다
  const [submitted, setSubmitted] = useState('');
  const queryClient = useQueryClient();

  const results = useQuery({
    queryKey: placeSearchQueryKey(submitted),
    queryFn: () => searchPlaces(submitted),
    enabled: submitted.length > 0,
  });

  const recent = useQuery({
    queryKey: RECENT_PLACES_QUERY_KEY,
    queryFn: getRecentPlaces,
    select: dedupePlaces,
  });

  // 저장이 실패해도 선택 흐름은 막지 않는다 — 다음에 목록이 조금 덜 정확할 뿐이다
  const save = useMutation({
    mutationFn: saveRecentPlace,
    onSettled: () => queryClient.invalidateQueries({ queryKey: RECENT_PLACES_QUERY_KEY }),
  });

  // 화면은 같은 장소를 하나로 합쳐 보여주므로, 한 줄을 지우면 그 장소의 서버 행을 전부 지운다.
  // 하나만 지우면 다른 행이 남아 있어 방금 지운 항목이 그대로 다시 나타난다
  const remove = useMutation({
    mutationFn: (place: DedupedRecentPlace) =>
      Promise.all(place.placeIds.map((placeId) => deleteRecentPlace(placeId))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECENT_PLACES_QUERY_KEY }),
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : '삭제에 실패했습니다. 다시 시도해 주세요.',
      );
    },
  });
  // 지우는 중인 행 식별 — placeIds 조합이 같으면 같은 그룹으로 본다
  const removingKey = remove.isPending ? remove.variables?.placeIds.join(',') : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;
    setSubmitted(query);
  }

  function clearInput() {
    setInput('');
    setSubmitted('');
  }

  function selectPlace(place: PlaceSearchResult) {
    save.mutate(place);
    onSelect(place);
  }

  /** 현재 위치에서 장소까지의 직선거리(m). 위치를 모르면 null이라 행에서 표시하지 않는다 */
  function distanceFromMe(place: PlaceSearchResult): number | null {
    if (currentLocation === null) return null;
    return haversineMeters(posToLatLng(currentLocation), posToLatLng(place));
  }

  const showResults = submitted.length > 0;
  const recentPlaces: DedupedRecentPlace[] = recent.data ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="장소 검색"
      className="pt-safe pb-safe fixed inset-y-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 flex-col bg-surface"
    >
      {/* 상단 — 뒤로가기 · (목적지 모드일 때만) 출발지 줄 + 바꾸기 · 검색 입력 */}
      <div className="flex items-start gap-1 px-2 pt-2">
        <div className="flex flex-col items-center">
          <button
            type="button"
            aria-label="뒤로 가기"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-[background-color] duration-75 active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-800">
              <path d="M15 5 8 12l7 7" {...stroke} />
            </svg>
          </button>
          {isStartMode ? null : (
            <button
              type="button"
              aria-label="출발지와 목적지 바꾸기"
              onClick={onSwap}
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-[background-color] duration-75 active:bg-gray-100"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  d="M8 4v13M5 14l3 3 3-3M16 20V7M13 10l3-3 3 3"
                  {...stroke}
                  strokeWidth={1.8}
                />
              </svg>
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 pr-2">
          {/* 목적지를 고르는 화면에서만 출발지 줄을 보여준다. 누르면 출발지 고르는 화면(field='start')으로 들어간다 */}
          {isStartMode ? null : (
            <button
              type="button"
              onClick={onEditStart}
              className="flex min-h-11 items-center gap-2.5 rounded-xl bg-background px-3.5 text-left transition-[background-color] duration-75 active:bg-gray-100"
            >
              <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">
                <span className="h-3.5 w-3.5 rounded-full border-[2.5px] border-primary" />
              </span>
              <span className="truncate text-[15px] text-gray-900">{startLabel}</span>
            </button>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 flex h-4 w-4 -translate-y-1/2 items-center justify-center"
            >
              <span className="h-3 w-3 rounded-[3px] bg-gray-800" />
            </span>
            <input
              type="text"
              inputMode="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isStartMode ? '출발지를 검색해 보세요' : '어디로 갈까요?'}
              enterKeyHint="search"
              autoComplete="off"
              autoFocus
              className="min-h-11 w-full rounded-xl border border-gray-200 bg-surface pr-11 pl-10 text-[15px] text-gray-900 placeholder-gray-400 transition-[border-color] duration-75 focus:border-primary focus:outline-none"
            />
            {input ? (
              <button
                type="button"
                aria-label="입력 지우기"
                onClick={clearInput}
                className="absolute top-1/2 right-0.5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-[background-color] duration-75 active:bg-gray-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path d="m7 7 10 10M17 7 7 17" {...stroke} />
                </svg>
              </button>
            ) : null}
          </form>
        </div>
      </div>

      <div className="flex gap-2 px-4 pt-3 pb-3">
        {isStartMode ? (
          <Chip onClick={onUseCurrentLocationAsStart}>현재 위치 사용</Chip>
        ) : (
          <Chip onClick={onRefreshLocation} disabled={locationLoading}>
            내 위치
          </Chip>
        )}
        <Chip onClick={onPickOnMap}>지도에서 선택</Chip>
      </div>

      <div className="h-px bg-gray-100" />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {showResults ? (
          <section>
            <SectionTitle>검색 결과</SectionTitle>
            {results.isPending ? (
              <StatusText>검색 중…</StatusText>
            ) : results.isError ? (
              <StatusText>
                {results.error instanceof ApiError
                  ? results.error.message
                  : '검색에 실패했습니다. 다시 시도해 주세요.'}
              </StatusText>
            ) : results.data.length === 0 ? (
              <StatusText>검색 결과가 없습니다.</StatusText>
            ) : (
              <ul>
                {results.data.map((place) => (
                  <li key={placeKey(place)}>
                    <PlaceRow
                      place={place}
                      kind="result"
                      distanceM={distanceFromMe(place)}
                      onClick={() => selectPlace(place)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 h-2 bg-background" />
          </section>
        ) : null}

        {/* 최근 검색 — 아직 못 받았거나 비어 있으면 섹션 자체를 숨긴다 */}
        {recentPlaces.length > 0 ? (
          <section>
            <SectionTitle>최근 검색</SectionTitle>
            <ul>
              {recentPlaces.map((place) => (
                <li key={placeKey(place)}>
                  <PlaceRow
                    place={place}
                    kind="recent"
                    distanceM={distanceFromMe(place)}
                    onClick={() => selectPlace(place)}
                    onDelete={() => remove.mutate(place)}
                    deleting={removingKey === place.placeIds.join(',')}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="px-4 pt-4 pb-1 text-sm font-semibold text-gray-500">{children}</h2>;
}

function StatusText({ children }: { children: string }) {
  return <p className="px-4 py-6 text-center text-sm text-gray-500">{children}</p>;
}
