import type { ReportTag } from '@/features/report/api/reports';

/**
 * 자전거 측면 다이어그램 — 제보된 부위(태그)를 붉게 강조해 한눈에 보여준다.
 * '기타' 태그는 특정 부위가 없어 강조하지 않는다.
 */
interface BikeDiagramProps {
  /** 강조할 부위 태그 목록 */
  highlighted: ReportTag[];
  /** 순수 장식용(정보 페이지 일러스트 등) — 보조기기에 캡션을 읽어주지 않음 */
  decorative?: boolean;
  className?: string;
}

const BASE = '#374151'; // gray-700
const WARN = 'var(--color-status-low)';

export function BikeDiagram({ highlighted, decorative = false, className = '' }: BikeDiagramProps) {
  const on = (tag: ReportTag) => highlighted.includes(tag);
  const color = (tag: ReportTag) => (on(tag) ? WARN : BASE);
  const width = (tag: ReportTag, base: number) => (on(tag) ? base + 1.5 : base);

  const parts = highlighted.filter((t) => t !== '기타' && t !== '반납 오류');

  return (
    <figure className={className} aria-hidden={decorative}>
      <svg viewBox="0 0 240 150" role="img" aria-label="자전거 부위 다이어그램" className="w-full">
        {/* 타이어 (앞·뒤 바퀴) */}
        <g stroke={color('타이어')} strokeWidth={width('타이어', 5)} fill="none">
          <circle cx="55" cy="105" r="31" />
          <circle cx="185" cy="105" r="31" />
        </g>
        {/* 바퀴살·허브 (장식) */}
        <g stroke="#d1d5db" strokeWidth="1.5" fill="none">
          <circle cx="55" cy="105" r="22" />
          <circle cx="185" cy="105" r="22" />
        </g>

        {/* 프레임 (탑·다운·시트 튜브 + 스테이 + 포크) */}
        <g stroke={color('프레임')} strokeWidth={width('프레임', 5)} fill="none" strokeLinecap="round">
          <path d="M92 52 L163 50" /> {/* 탑 튜브 */}
          <path d="M110 106 L166 52" /> {/* 다운 튜브 */}
          <path d="M92 52 L110 106" /> {/* 시트 튜브 */}
          <path d="M55 105 L110 106" /> {/* 체인 스테이 */}
          <path d="M55 105 L92 52" /> {/* 시트 스테이 */}
          <path d="M166 52 L185 105" /> {/* 포크 */}
        </g>

        {/* 체인 (크랭크 + 체인선 + 페달) */}
        <g stroke={color('체인')} strokeWidth={width('체인', 3.5)} fill="none">
          <circle cx="110" cy="106" r="10" />
          <path d="M55 100 L102 99" />
          <path d="M55 111 L104 113" />
          <path d="M110 106 L122 92" strokeLinecap="round" />
          <path d="M118 90 L128 90" strokeWidth={width('체인', 5)} strokeLinecap="round" />
        </g>

        {/* 안장 (시트 포스트 + 안장) */}
        <g stroke={color('안장')} strokeLinecap="round" fill={color('안장')}>
          <path d="M90 50 L88 40" strokeWidth={width('안장', 4)} fill="none" />
          <rect x="72" y="33" width="33" height="8" rx="4" stroke="none" />
        </g>

        {/* 브레이크 (핸들바 + 레버 + 앞 캘리퍼) */}
        <g stroke={color('브레이크')} strokeLinecap="round" fill="none">
          <path d="M166 52 L170 36" strokeWidth={width('브레이크', 4)} /> {/* 스템 */}
          <path d="M162 35 Q170 32 180 36" strokeWidth={width('브레이크', 4)} /> {/* 핸들바 */}
          <path d="M178 37 L184 45" strokeWidth={width('브레이크', 3)} /> {/* 레버 */}
          <path d="M176 78 Q185 72 194 78" strokeWidth={width('브레이크', 3.5)} /> {/* 캘리퍼 */}
        </g>
      </svg>
      {!decorative && (
        <figcaption className="sr-only">
          {parts.length > 0 ? `제보된 부위: ${parts.join(', ')}` : '제보된 부위 없음'}
        </figcaption>
      )}
    </figure>
  );
}
