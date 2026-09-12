import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import type { PlaceSearchResult } from '@/shared/api/types';
import { Chip } from '@/shared/ui/Chip';
import {
  RECENT_PLACES_QUERY_KEY,
  dedupePlaces,
  getRecentPlaces,
  placeSearchQueryKey,
  saveRecentPlace,
  searchPlaces,
} from '@/features/map/api/places';
import { PlaceRow } from '@/features/map/components/PlaceRow';

/** 출발지·내 위치·지도에서 선택은 각각 별도 이슈(현재위치·09)라 지금은 안내만 띄운다 */
const COMING_SOON = '준비 중입니다.';

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
  /** 결과·최근 검색에서 장소를 고르면 호출. 최근 검색 저장은 이 컴포넌트가 처리한다 */
  onSelect: (place: PlaceSearchResult) => void;
  showToast: (text: string) => void;
}

/**
 * 08 장소 검색 — 07 위에 얹는 전체 화면 오버레이(새 라우트 없음: 지도 재생성 방지).
 * 검색은 엔터/검색 버튼으로 한 번만 실행한다(글자마다 자동 검색하면 네이버 API 호출이 늘어난다).
 */
export function PlaceSearchOverlay({ onClose, onSelect, showToast }: PlaceSearchOverlayProps) {
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

  const showResults = submitted.length > 0;
  const recentPlaces = recent.data ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="장소 검색"
      className="pt-safe pb-safe fixed inset-y-0 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 flex-col bg-surface"
    >
      {/* 상단 — 뒤로가기 · 출발/목적지 · 바꾸기 */}
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
          <button
            type="button"
            aria-label="출발지와 목적지 바꾸기"
            onClick={() => showToast(COMING_SOON)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-[background-color] duration-75 active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path d="M8 4v13M5 14l3 3 3-3M16 20V7M13 10l3-3 3 3" {...stroke} strokeWidth={1.8} />
            </svg>
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 pr-2">
          {/* 출발지 — 현재위치 기능이 붙기 전까지 고정 문구 */}
          <button
            type="button"
            onClick={() => showToast(COMING_SOON)}
            className="flex min-h-11 items-center gap-2.5 rounded-xl bg-background px-3.5 text-left transition-[background-color] duration-75 active:bg-gray-100"
          >
            <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">
              <span className="h-3.5 w-3.5 rounded-full border-[2.5px] border-primary" />
            </span>
            <span className="truncate text-[15px] text-gray-900">현재 위치</span>
          </button>

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
              placeholder="어디로 갈까요?"
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
        <Chip onClick={() => showToast(COMING_SOON)}>내 위치</Chip>
        <Chip onClick={() => showToast(COMING_SOON)}>지도에서 선택</Chip>
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
                    <PlaceRow place={place} kind="result" onClick={() => selectPlace(place)} />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 h-2 bg-background" />
          </section>
        ) : null}

        {/* 최근 검색 — 아직 못 받았거나 비어 있으면 섹션 자체를 숨긴다 (삭제 기능은 API 확정 후) */}
        {recentPlaces.length > 0 ? (
          <section>
            <SectionTitle>최근 검색</SectionTitle>
            <ul>
              {recentPlaces.map((place) => (
                <li key={placeKey(place)}>
                  <PlaceRow place={place} kind="recent" onClick={() => selectPlace(place)} />
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
