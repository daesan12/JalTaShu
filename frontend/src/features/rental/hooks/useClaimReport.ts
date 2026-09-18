import { useState } from 'react';
import type { BikeReport } from '@/features/rental/api/bikes';
import {
  isExhausted,
  readReportLog,
  recordReport,
  type ReportLog,
} from '@/features/rental/lib/claimReportLimit';

/**
 * 허위 제보 신고 상태 — 18 자전거 상태와 20 제보 리스트가 같은 시트를 쓰므로 여기로 모았다.
 * 신고 기록은 기기 저장소에 남는다(백엔드에 중복·횟수 제한이 없어서 — claimReportLimit 참고).
 */
export function useClaimReport() {
  const [target, setTarget] = useState<BikeReport | null>(null);
  const [log, setLog] = useState<ReportLog>(readReportLog);

  return {
    /** 시트에 띄울 제보 (null이면 닫힘) */
    target,
    usedCount: log.claimIds.length,
    /** 오늘 한도를 다 썼는지 — 카드의 신고 버튼을 잠근다 */
    exhausted: isExhausted(log),
    isReported: (claimId: number) => log.claimIds.includes(claimId),
    open: (report: BikeReport) => setTarget(report),
    close: () => setTarget(null),
    markReported: (claimId: number) => {
      setLog(recordReport(claimId));
      setTarget(null);
    },
  };
}
