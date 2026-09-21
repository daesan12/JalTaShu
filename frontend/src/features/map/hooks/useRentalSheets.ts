import { useState } from 'react';
import type { BikeStation } from '@/shared/api/types';
import type { StationSnap } from '@/features/map/components/StationSheet';

/**
 * 대여소 시트(07-1)와 반납 번호 입력 시트.
 * 대여는 QR 스캔으로 옮겨가 시트가 없다(`useCycleRental`).
 * 시트는 한 번에 하나만 열린다 — 여는 함수들이 서로를 닫는 이유다.
 */
export function useRentalSheets(stations: BikeStation[] | undefined) {
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [stationSnap, setStationSnap] = useState<StationSnap>('peek');
  const [returnSheetOpen, setReturnSheetOpen] = useState(false);
  // 대여소 시트를 닫은 뒤에도 반납 시트가 어느 대여소인지 알아야 해서 따로 기억해 둔다
  const [returnStationId, setReturnStationId] = useState<string | null>(null);

  // 목록이 갱신돼 선택한 대여소가 사라지면 시트도 닫힌다
  const selectedStation = stations?.find((s) => s.stationId === selectedStationId) ?? null;

  // 대여소를 고르면 항상 요약부터 보여준다 — 확장 상태가 다음 대여소로 따라오면 안 된다.
  // 시트는 한 번에 하나라 반납 시트가 열려 있었으면 같이 닫는다
  function selectStation(stationId: string | null) {
    setStationSnap('peek');
    setSelectedStationId(stationId);
    if (stationId !== null) setReturnSheetOpen(false);
  }

  /** 검색을 열 때 등 — 대여소 시트만 조용히 닫는다 (다른 시트는 건드리지 않는다) */
  function closeStationSheet() {
    setSelectedStationId(null);
  }

  /**
   * 대여소 시트의 "반납하기" — 지금 열려 있는 대여소를 반납 대여소로 삼는다.
   * 대여소 시트를 닫으면서 그 대여소 id는 따로 기억해 둔다 — 시트를 닫은 뒤에도
   * 반납 번호 입력 시트가 "어느 대여소인지"를 알아야 하기 때문이다.
   */
  function openReturnSheet() {
    if (selectedStation === null) return;
    setReturnStationId(selectedStation.stationId);
    setSelectedStationId(null);
    setReturnSheetOpen(true);
  }

  return {
    selectedStationId,
    selectedStation,
    stationSnap,
    setStationSnap,
    selectStation,
    closeStationSheet,
    returnSheetOpen,
    openReturnSheet,
    closeReturnSheet: () => setReturnSheetOpen(false),
    returnStationId,
  };
}
