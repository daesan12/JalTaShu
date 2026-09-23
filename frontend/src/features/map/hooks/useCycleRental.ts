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

interface ReturnInput {
  cycleId: string;
  stationId: string;
  stationName: string;
  latitude: number;
  longitude: number;
}

interface UseCycleRentalOptions {
  location: ReturnType<typeof useCurrentLocation>;
  showToast: (message: string) => void;
  onReturned?: (result: CycleReturnResult, input: ReturnInput) => void;
}

/**
 * QR 한 번으로 대여하고, 같은 자전거를 다시 찍으면 반납한다(07).
 *
 * 스캔 화면은 지도 위 오버레이(`QrScanView`)라 지도·경로 안내 상태가 그대로 남는다.
 * 대여인지 반납인지는 "지금 빌린 자전거"와 **번호가 같은지**로 가른다.
 *
 * 반납할 대여소는 묻지 않고 가장 가까운 곳으로 정한다 — QR만 찍는 흐름이라 고를 화면이 없다.
 * 대신 어느 대여소에 넣었는지 토스트로 알려, 잘못 잡혔으면 사용자가 바로 알 수 있게 한다.
 */
export function useCycleRental({ location, showToast, onReturned }: UseCycleRentalOptions) {
  const queryClient = useQueryClient();

  /*
   * 지금 빌린 자전거를 화면도 알아야 한다 — "대여하기"와 "반납하기" 라벨이 이 값으로 갈린다.
   * 처음 값은 기기 저장소(localStorage)에서 읽고, 서버 조회가 오면 서버 값으로 맞춘다.
   */
  const [session, setSession] = useState<RentalSession | null>(readRentalSession);
  // 위치·대여소를 기다리는 동안에도 같은 번호가 두 번 처리되면 안 된다
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

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
    // 대여소 이름은 서버에 보내지 않는다 — 토스트에 쓰려고 함께 들고 다닐 뿐이다
    mutationFn: ({ cycleId, stationId, latitude, longitude }: ReturnInput) =>
      returnCycle({ cycleId, stationId, latitude, longitude }),
    onSuccess: async (result, input) => {
      await settleRental(null);
      showToast(`${input.cycleId} 자전거를 ${input.stationName}에 반납했습니다.`);
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
   * 대여·반납할 대여소 = 지금 위치에서 가장 가까운 대여소.
   * 위치는 **이 순간 새로 조회한다** — 앱을 켤 때 잡은 위치는 이미 멀리 떨어졌을 수 있다.
   * 대여소 목록이 아직 없으면 받아올 때까지 기다린다.
   */
  async function resolveStation(): Promise<
    { ok: true; station: BikeStation; position: Pos } | { ok: false; message: string }
  > {
    const result = await location.request();
    const position = result.ok ? result.position : positionRef.current;
    if (position === null) {
      return {
        ok: false,
        message: result.ok ? '현재 위치를 확인할 수 없습니다.' : LOCATION_ERROR_TEXT[result.error],
      };
    }
    let stations: BikeStation[] | undefined;
    try {
      stations = await queryClient.ensureQueryData({
        queryKey: BIKE_STATIONS_QUERY_KEY,
        queryFn: getBikeStations,
      });
    } catch {
      stations = undefined;
    }
    const station = nearestStation(stations, position);
    if (station === null) {
      return { ok: false, message: '대여소 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }
    return { ok: true, station, position };
  }

  /** 스캔한 번호 하나를 대여나 반납으로 처리한다 */
  async function handleCode(rawCode: string) {
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

    busyRef.current = true;
    setBusy(true);
    try {
      const target = await resolveStation();
      if (!target.ok) {
        showToast(target.message);
        return;
      }
      const { station, position } = target;
      if (current === null) {
        await rent.mutateAsync({
          cycleId: code,
          stationId: station.stationId,
          latitude: position.yPos,
          longitude: position.xPos,
        });
      } else {
        await giveBack.mutateAsync({
          cycleId: code,
          stationId: station.stationId,
          stationName: station.name,
          latitude: position.yPos,
          longitude: position.xPos,
        });
      }
    } catch {
      // 실패 안내는 각 mutation의 onError가 이미 띄웠다
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return {
    handleCode,
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
