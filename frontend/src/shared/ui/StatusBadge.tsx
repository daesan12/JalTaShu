import { STATION_STATUS_LABEL, type StationStatus } from '@/shared/ui/stationStatus';

/** Figma StatusBadge 변형(State=여유/보통/부족)과 1:1 */
const STATUS_CLASS: Record<StationStatus, string> = {
  high: 'bg-primary-light text-primary',
  mid: 'bg-amber-50 text-status-mid',
  low: 'bg-red-50 text-status-low',
};

export function StatusBadge({ status, className = '' }: { status: StationStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]} ${className}`}
    >
      {STATION_STATUS_LABEL[status]}
    </span>
  );
}
