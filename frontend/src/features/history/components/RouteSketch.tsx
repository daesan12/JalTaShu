import { GRADE_META, WALK_COLOR, type GradeClass } from '@/features/history/lib/grade';
import type { PathSegment } from '@/features/history/api/rides';

/**
 * 추상 경로 그림 (23 상단) — 회색 그리드 위에 경사별 색 구간으로 경로를 표현.
 * 네이버 지도 도입 후 실제 지도 + 폴리라인으로 교체 예정.
 */
export function RouteSketch({ path }: { path: PathSegment[] }) {
  const first = path[0]?.points[0];
  const lastSegment = path[path.length - 1];
  const last = lastSegment?.points[lastSegment.points.length - 1];

  return (
    <svg
      viewBox="0 0 100 64"
      role="img"
      aria-label="이동 경로 개요 (경사도별 색 구분)"
      className="block w-full bg-background"
    >
      {/* 그리드 */}
      <g stroke="#e5e7eb" strokeWidth="0.4">
        {[20, 40, 60, 80].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="64" />
        ))}
        {[16, 32, 48].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} />
        ))}
      </g>

      {/* 경로 구간 */}
      {path.map((segment, i) => {
        const isWalk = segment.kind === 'walk';
        const color = isWalk ? WALK_COLOR : GRADE_META[segment.kind as GradeClass].color;
        return (
          <polyline
            key={i}
            points={segment.points.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={isWalk ? '0.5 5' : undefined}
          />
        );
      })}

      {/* 출발·도착 점 */}
      {first && <circle cx={first[0]} cy={first[1]} r="3.2" fill={WALK_COLOR} />}
      {last && <circle cx={last[0]} cy={last[1]} r="3.2" fill="#1f2937" />}
    </svg>
  );
}
