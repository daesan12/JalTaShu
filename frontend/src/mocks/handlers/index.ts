import { authHandlers } from '@/mocks/handlers/auth';
import { rideHandlers } from '@/mocks/handlers/rides';
import { supportHandlers } from '@/mocks/handlers/support';
import { reportHandlers } from '@/mocks/handlers/reports';
import { mapHandlers } from '@/mocks/handlers/map';
import { adminAuthHandlers } from '@/mocks/handlers/adminAuth';
import { adminStationHandlers } from '@/mocks/handlers/adminStations';
import { adminClaimHandlers } from '@/mocks/handlers/adminClaims';
import { adminCycleHandlers } from '@/mocks/handlers/adminCycles';
import { adminUserHandlers } from '@/mocks/handlers/adminUsers';
import { adminNoticeHandlers } from '@/mocks/handlers/adminNotices';

/**
 * msw는 배열 앞에서부터 먼저 맞는 핸들러를 쓴다 — 같은 접두사의 고정 경로가
 * :param 핸들러에 잡히지 않도록 순서를 지킨다.
 * ⚠ adminClaimHandlers(GET /api/admin/cycle/claim)는 adminCycleHandlers의
 *   GET /api/admin/cycle/:cycleId보다 반드시 앞에 있어야 한다.
 */
export const handlers = [
  ...authHandlers,
  ...rideHandlers,
  ...supportHandlers,
  ...reportHandlers,
  ...mapHandlers,
  ...adminAuthHandlers,
  ...adminStationHandlers,
  ...adminClaimHandlers,
  ...adminCycleHandlers,
  ...adminUserHandlers,
  ...adminNoticeHandlers,
];
