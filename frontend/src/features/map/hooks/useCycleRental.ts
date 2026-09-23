import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BikeStation, Pos } from '@/shared/api/types';
import { ApiError } from '@/shared/api/client';
import {
  clearRentalSession,
  readRentalSession,
  writeRentalSession,
  type RentalSession,
} from '@/features/rental/lib/rentalSession';
import { rentCycle, returnCycle } from '@/features/map/api/cycle';
import type { CycleReturnResult } from '@/features/map/api/cycle';
import { nearestStation } from '@/features/map/lib/nearestStation';

interface ReturnInput {
  cycleId: string;
  stationId: string;
  stationName: string;
  latitude: number;
  longitude: number;
}

interface UseCycleRentalOptions {
  stations: BikeStation[] | undefined;
  position: Pos | null;
  showToast: (message: string) => void;
  onReturned?: (result: CycleReturnResult, input: ReturnInput) => void;
}

/**
 * QR 한 번으로 대여하고, 같은 자전거를 다시 찍으면 반납한다(07).
 *
 * 스캔 화면은 `/report/scan`을 그대로 쓰고(`?next=/`), 돌아올 때 `?code=`로 번호를 받는다.
 * 대여인지 반납인지는 앱이 기억해 둔 "지금 빌린 자전거"와 **번호가 같은지**로 가른다.
 *
 * 반납할 대여소는 묻지 않고 가장 가까운 곳으로 정한다 — QR만 찍는 흐름이라 고를 화면이 없다.
 * 대신 어느 대여소에 넣었는지 토스트로 알려, 잘못 잡혔으면 사용자가 바로 알 수 있게 한다.
 */
export function useCycleRental({ stations, position, showToast, onReturned }: UseCycleRentalOptions) {
  const queryClient = useQueryClient();

  /*
   * 지금 빌린 자전거를 화면도 알아야 한다 — "대여하기"와 "반납하기" 라벨이 이 값으로 갈린다.
   * 진짜 저장소는 localStorage(`rentalSession`)지만 리액트가 그 변화를 알 수 없으므로,
   * 대여·반납이 성공한 자리에서 state를 함께 갱신한다. 처음 값은 저장소에서 읽어
   * 앱을 껐다 켜도 빌린 상태가 유지된다.
   */
  const [session, setSession] = useState<RentalSession | null>(readRentalSession);

  const rent = useMutation({
    mutationFn: rentCycle,
    onSuccess: (rentedAt, { cycleId }) => {
      writeRentalSession({ cycleId, rentedAt });
      setSession({ cycleId, rentedAt });
      showToast(`${cycleId} 자전거를 대여했습니다.`);
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : '대여하지 못했습니다.');
    },
  });

  const giveBack = useMutation({
    // 대여소 이름은 서버에 보내지 않는다 — 토스트에 쓰려고 함께 들고 다닐 뿐이다
    mutationFn: ({ cycleId, stationId, latitude, longitude }: ReturnInput) =>
      returnCycle({ cycleId, stationId, latitude, longitude }),
    onSuccess: (result, input) => {
      const { cycleId, stationName } = input;
      clearRentalSession();
      setSession(null);
      showToast(`${cycleId} 자전거를 ${stationName}에 반납했습니다.`);
      onReturned?.(result, input);
      // 반납으로 이용 기록 한 건이 생긴다 — 나의 경로가 열릴 때 새로 받게 한다
      void queryClient.invalidateQueries({ queryKey: ['usageList'] });
      void queryClient.invalidateQueries({ queryKey: ['usageStats'] });
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : '반납하지 못했습니다.');
    },
  });

  /** 스캔한 번호 하나를 대여나 반납으로 처리한다 */
  function handleCode(code: string) {
    const session = readRentalSession();

    if (session === null) {
      const station = nearestStation(stations, position);
      if (station === null || position === null) {
        showToast('현재 위치와 대여소 정보를 확인한 뒤 다시 시도해 주세요.');
        return;
      }
      rent.mutate({
        cycleId: code,
        stationId: station.stationId,
        latitude: position.yPos,
        longitude: position.xPos,
      });
      return;
    }

    if (session.cycleId !== code) {
      showToast(`${session.cycleId} 자전거를 먼저 반납해 주세요.`);
      return;
    }

    const station = nearestStation(stations, position);
    if (station === null || position === null) {
      showToast('현재 위치와 대여소 정보를 확인한 뒤 다시 시도해 주세요.');
      return;
    }
    giveBack.mutate({
      cycleId: code,
      stationId: station.stationId,
      stationName: station.name,
      latitude: position.yPos,
      longitude: position.xPos,
    });
  }

  return {
    handleCode,
    /** 지금 빌린 자전거. 없으면 null — 화면은 이걸로 대여/반납을 가른다 */
    session,
    /** 번호 입력 시트처럼 이 훅을 거치지 않고 반납했을 때 상태를 맞춘다 */
    syncSession: () => setSession(readRentalSession()),
  };
}

/**
 * `?code=`가 붙어 돌아오면 한 번만 처리하고 파라미터를 지운다.
 * 훅을 나눈 이유는 위 훅이 요청 로직만 갖게 하고, "언제 부르는가"는 URL이 정하게 두기 위해서다.
 */
export function useScannedCode(
  code: string | null,
  handle: (code: string) => void,
  clearCode: () => void,
) {
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (code === null || code.length === 0) {
      handledRef.current = null;
      return;
    }
    if (handledRef.current === code) return;
    handledRef.current = code;
    handle(code);
    clearCode();
    // handle·clearCode는 렌더마다 새로 만들어지므로 의존성에 넣으면 같은 code를 다시 처리한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
}
