import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BikeStation, Pos } from '@/shared/api/types';
import { ApiError } from '@/shared/api/client';
import {
  clearRentalSession,
  readRentalSession,
  writeRentalSession,
  type RentalSession,
} from '@/features/rental/lib/rentalSession';
import {
  CURRENT_RENTAL_QUERY_KEY,
  getCurrentRental,
  rentCycle,
  returnCycle,
  type CurrentRental,
} from '@/features/map/api/cycle';
import type { CycleReturnResult } from '@/features/map/api/cycle';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import {
  LOCATION_ERROR_TEXT,
  type useCurrentLocation,
} from '@/features/map/hooks/useCurrentLocation';
import { nearestStation } from '@/features/map/lib/nearestStation';

/** 서버 `CycleRentalRequest`의 번호 형식과 같다 — 어긋난 번호는 보내 봐야 400이다 */
const CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

/** 대여·반납할 대여소 하나 — 대여소 목록(`BikeStation`)과 경로의 대여소(`RouteStation`)를 같은 모양으로 */
export interface StationChoice {
  stationId: string;
  name: string;
  lat: number;
  lng: number;
}

/** 확인 창에 띄울 대여·반납 — 사용자가 대여소를 확정하면 그때 서버에 보낸다 */
export interface PendingStationAction {
  kind: 'rent' | 'return';
  cycleId: string;
  /** 먼저 권하는 대여소 — 안내 중이면 경로의 대여소, 아니면 가장 가까운 대여소 */
  suggested: StationChoice;
  /** 요청 시점의 위치. 못 얻었으면 null이고, 그때는 고른 대여소 좌표를 보낸다 */
  position: Pos | null;
}

/** 안내 중인 경로가 쓰기로 한 대여소들 — 안내 중이 아니면 넘기지 않는다 */
export interface PlannedStations {
  rent: StationChoice | null;
  return: StationChoice | null;
}

interface ReturnInput {
  cycleId: string;
  station: StationChoice;
  latitude: number;
  longitude: number;
}

interface UseCycleRentalOptions {
  location: ReturnType<typeof useCurrentLocation>;
  showToast: (message: string) => void;
  onRented?: (station: StationChoice) => void;
  onReturned?: (result: CycleReturnResult, input: ReturnInput) => void;
}

export function toChoice(station: BikeStation): StationChoice {
  return { stationId: station.stationId, name: station.name, lat: station.lat, lng: station.lng };
}

function nearestChoice(stations: BikeStation[] | undefined, position: Pos | null) {
  const station = nearestStation(stations, position);
  return station === null ? null : toChoice(station);
}

/**
 * QR로 대여하고, 반납은 버튼 하나로 한다(07·12).
 *
 * 스캔 화면은 지도 위 오버레이(`QrScanView`)라 지도·경로 안내 상태가 그대로 남는다.
 * 대여인지 반납인지는 "지금 빌린 자전거"와 **번호가 같은지**로 가른다.
 *
 * **반납은 QR 없이 한다**(#145) — 빌린 자전거 번호는 이미 알고 있다. 대신 대여소를 먼저 확인받는다
 * (`pending` → 확인 창). 안내 중이면 경로의 반납 대여소를 권해 GPS가 틀려도 엉뚱한 곳에 넣지 않고,
 * 다른 대여소를 고를 수도 있다. 안내 중 대여도 같은 이유로 경로의 대여 대여소를 확인받는다.
 * 안내가 아닐 때 대여는 전처럼 가장 가까운 대여소로 바로 처리한다 — QR만 찍는 흐름이다.
 */
export function useCycleRental({
  location,
  showToast,
  onRented,
  onReturned,
}: UseCycleRentalOptions) {
  const queryClient = useQueryClient();

  /*
   * 지금 빌린 자전거를 화면도 알아야 한다 — "대여하기"와 "반납하기" 라벨이 이 값으로 갈린다.
   * 처음 값은 기기 저장소(localStorage)에서 읽고, 서버 조회가 오면 서버 값으로 맞춘다.
   */
  const [session, setSession] = useState<RentalSession | null>(readRentalSession);
  // 위치·대여소를 기다리는 동안에도 같은 번호가 두 번 처리되면 안 된다
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pending, setPending] = useState<PendingStationAction | null>(null);

  // 안내 중에는 계속 갱신되는 위치 — 단발 조회가 실패했을 때 대신 쓴다
  const positionRef = useRef<Pos | null>(location.position);
  useEffect(() => {
    positionRef.current = location.position;
  });

  const currentRental = useQuery({
    queryKey: CURRENT_RENTAL_QUERY_KEY,
    queryFn: getCurrentRental,
  });

  // 서버가 기준이다 — 다른 기기에서 반납했거나 계정을 바꿨으면 기기 기억을 고친다
  useEffect(() => {
    if (!currentRental.isSuccess) return;
    applyRental(currentRental.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRental.isSuccess, currentRental.dataUpdatedAt]);

  function applyRental(rental: CurrentRental | null) {
    if (rental === null) {
      clearRentalSession();
      setSession(null);
      return;
    }
    const next = { cycleId: rental.cycleId, rentedAt: rental.rentedAt };
    writeRentalSession(next);
    setSession(next);
  }

  /** 대여·반납이 성공한 자리에서 캐시를 먼저 고친다 — 진행 중이던 옛 조회가 덮어쓰지 않게 */
  async function settleRental(rental: CurrentRental | null) {
    await queryClient.cancelQueries({ queryKey: CURRENT_RENTAL_QUERY_KEY });
    queryClient.setQueryData(CURRENT_RENTAL_QUERY_KEY, rental);
    applyRental(rental);
  }

  /** 서버와 어긋났다는 신호(이미 대여 중·대여 중 아님)를 받으면 다시 맞춘다 */
  function resyncRental() {
    void queryClient.invalidateQueries({ queryKey: CURRENT_RENTAL_QUERY_KEY });
  }

  const rent = useMutation({
    mutationFn: rentCycle,
    onSuccess: async (rentedAt, { cycleId }) => {
      await settleRental({ cycleId, rentedAt });
      showToast(`${cycleId} 자전거를 대여했습니다.`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 409) resyncRental();
      showToast(error instanceof ApiError ? error.message : '대여하지 못했습니다.');
    },
  });

  const giveBack = useMutation({
    // 대여소 이름·좌표는 서버에 보내지 않는다 — 토스트와 안내 재탐색에 쓰려고 함께 들고 다닐 뿐이다
    mutationFn: ({ cycleId, station, latitude, longitude }: ReturnInput) =>
      returnCycle({ cycleId, stationId: station.stationId, latitude, longitude }),
    onSuccess: async (result, input) => {
      await settleRental(null);
      showToast(`${input.cycleId} 자전거를 ${input.station.name}에 반납했습니다.`);
      onReturned?.(result, input);
      invalidateUsage();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 400) resyncRental();
      showToast(error instanceof ApiError ? error.message : '반납하지 못했습니다.');
    },
  });

  // 반납으로 이용 기록 한 건이 생긴다 — 나의 경로가 열릴 때 새로 받게 한다
  function invalidateUsage() {
    void queryClient.invalidateQueries({ queryKey: ['usageList'] });
    void queryClient.invalidateQueries({ queryKey: ['usageStats'] });
    // 마이페이지의 이번 달 이용 통계
    void queryClient.invalidateQueries({ queryKey: ['me'] });
  }

  /**
   * 대여·반납 시점의 위치. **이 순간 새로 조회한다** — 앱을 켤 때 잡은 위치는 이미 멀리 떨어졌을
   * 수 있다. 조회가 실패하면 안내 중 계속 받던 위치를 쓰고, 그것도 없으면 null이다.
   * 대여소가 이미 정해져 있으면(안내 중) 위치는 서버에 참고로만 가므로 빠른 조회로 충분하다 —
   * GPS가 안 잡히는 시연장에서 정밀 조회를 8초씩 기다리지 않게 한다.
   */
  async function currentPosition(
    quick: boolean,
  ): Promise<{ position: Pos | null; error: string | null }> {
    const result = await location.request({ quick });
    if (result.ok) return { position: result.position, error: null };
    return { position: positionRef.current, error: LOCATION_ERROR_TEXT[result.error] };
  }

  /** 대여소 목록 — 아직 없으면 받아올 때까지 기다린다. 실패하면 undefined */
  async function loadStations(): Promise<BikeStation[] | undefined> {
    try {
      return await queryClient.ensureQueryData({
        queryKey: BIKE_STATIONS_QUERY_KEY,
        queryFn: getBikeStations,
      });
    } catch {
      return undefined;
    }
  }

  /** 위치를 확인하는 동안 같은 요청이 두 번 들어오지 않게 잠근다 */
  async function withBusy(task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } catch {
      // 실패 안내는 각 mutation의 onError가 이미 띄웠다
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  /**
   * 반납 버튼(#145) — QR 없이 지금 빌린 자전거를 반납한다. 바로 보내지 않고 확인 창부터 띄운다.
   * 권하는 대여소: 안내 중이면 경로의 반납 대여소, 아니면 지금 위치에서 가장 가까운 대여소.
   */
  function startReturn(planned: PlannedStations | null = null) {
    const current = readRentalSession();
    if (current === null) {
      showToast('빌린 자전거가 없습니다.');
      return;
    }
    return withBusy(async () => {
      const { position, error } = await currentPosition(planned?.return != null);
      const suggested = planned?.return ?? nearestChoice(await loadStations(), position);
      if (suggested === null) {
        showToast(error ?? '대여소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setPending({ kind: 'return', cycleId: current.cycleId, suggested, position });
    });
  }

  /**
   * 스캔한 번호 하나를 대여나 반납으로 처리한다.
   * - 빌린 자전거와 같은 번호 → 반납 버튼과 같다(확인 창)
   * - 안내 중 대여 → 경로의 대여 대여소를 확인 창으로 권한다
   * - 그 밖의 대여 → 가장 가까운 대여소로 바로 대여한다
   */
  function handleCode(rawCode: string, planned: PlannedStations | null = null) {
    if (busyRef.current) return;
    const code = rawCode.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      showToast('자전거 번호를 확인해 주세요. (영문·숫자 6~12자)');
      return;
    }
    const current = readRentalSession();
    if (current !== null && current.cycleId !== code) {
      showToast(`${current.cycleId} 자전거를 먼저 반납해 주세요.`);
      return;
    }
    if (current !== null) return startReturn(planned);

    return withBusy(async () => {
      const { position, error } = await currentPosition(planned?.rent != null);
      if (planned?.rent) {
        setPending({ kind: 'rent', cycleId: code, suggested: planned.rent, position });
        return;
      }
      const station = nearestChoice(await loadStations(), position);
      if (station === null || position === null) {
        showToast(error ?? '대여소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      await rentAt(code, station, position);
    });
  }

  async function rentAt(cycleId: string, station: StationChoice, position: Pos | null) {
    // 위치를 못 얻었으면 고른 대여소 자리에 있다고 본다 — 서버는 좌표를 필수로 받는다
    await rent.mutateAsync({
      cycleId,
      stationId: station.stationId,
      latitude: position?.yPos ?? station.lat,
      longitude: position?.xPos ?? station.lng,
    });
    onRented?.(station);
  }

  /** 확인 창에서 대여소를 확정했다 — 권한 곳이든 다른 곳이든 */
  function confirmPending(station: StationChoice) {
    const action = pending;
    if (action === null) return;
    return withBusy(async () => {
      try {
        if (action.kind === 'rent') {
          await rentAt(action.cycleId, station, action.position);
          return;
        }
        await giveBack.mutateAsync({
          cycleId: action.cycleId,
          station,
          latitude: action.position?.yPos ?? station.lat,
          longitude: action.position?.xPos ?? station.lng,
        });
      } finally {
        setPending(null);
      }
    });
  }

  return {
    handleCode,
    startReturn,
    /** 확인 창에 띄울 대여·반납. 없으면 null */
    pending,
    confirmPending,
    cancelPending: () => setPending(null),
    /** 지금 빌린 자전거. 없으면 null — 화면은 이걸로 대여/반납을 가른다 */
    session,
    /** 위치 확인·대여·반납 요청 중 */
    busy,
    /** 번호 입력 시트처럼 이 훅을 거치지 않고 반납했을 때 상태를 맞춘다 */
    markReturned: () => {
      void settleRental(null);
      invalidateUsage();
    },
  };
}
