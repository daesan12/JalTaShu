import { useEffect, useRef, useState } from 'react';
import type { PopupNotice } from '@/features/map/api/noticePopups';

interface NoticePopupProps {
  notices: PopupNotice[];
  /** 팝업을 닫기만 한다 */
  onClose: () => void;
  /** 7일 동안 다시 띄우지 않고 닫는다 */
  onHideForWeek: () => void;
  /** 관리자가 연결해 둔 공지사항을 연다 */
  onOpenNotice: (noticeId: number) => void;
}

/** Figma 07-1 공지 이미지 크기 — 이 비율로 자리를 잡고, 실제 이미지는 비율이 달라도 안 잘리게 맞춘다 */
const IMAGE_WIDTH = 283;
const IMAGE_HEIGHT = 276;

/**
 * 07-1 공지 팝업 — 이미지를 좌우로 넘겨 보고, 연결된 공지가 있으면 이미지를 눌러 이동한다.
 * 넘기는 방법은 스와이프와 양옆 화살표 둘 다. 캐러셀은 CSS scroll-snap으로만 구현한다(라이브러리 없음).
 * 마지막 장에서 더 넘겨도 처음으로 돌아가지 않는다.
 */
export function NoticePopup({ notices, onClose, onHideForWeek, onOpenNotice }: NoticePopupProps) {
  const [current, setCurrent] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 뒤 화면으로 초점이 새지 않도록 팝업 자체에 초점을 준다
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function goTo(index: number) {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ left: index * list.clientWidth, behavior: 'smooth' });
  }

  const multiple = notices.length > 1;

  return (
    // 팝업 바깥(어두운 배경)을 누르면 닫힌다 — 7일 숨김은 적용되지 않는다
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="공지"
        tabIndex={-1}
        className="flex w-full flex-col items-center outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 화살표는 카드 양옆 바깥에 둔다. 카드 폭 + 화살표 2개가 좁은 화면에도 들어가도록 flex로 나눈다 */}
        <div className="flex w-full items-center justify-center">
          {multiple && (
            <ArrowButton direction="prev" disabled={current === 0} onClick={() => goTo(current - 1)} />
          )}

          <div
            className="relative w-full overflow-hidden rounded-2xl bg-surface"
            style={{ maxWidth: IMAGE_WIDTH }}
          >
            <ul
              ref={listRef}
              // 한 장씩 딱 맞게 멈추는 가로 스크롤. 스크롤 위치로 현재 장을 계산한다
              onScroll={(e) => {
                const el = e.currentTarget;
                setCurrent(Math.round(el.scrollLeft / el.clientWidth));
              }}
              className="flex snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
              style={{ aspectRatio: `${IMAGE_WIDTH} / ${IMAGE_HEIGHT}` }}
            >
              {notices.map((notice, index) => {
                // 지역 상수로 빼야 아래 onClick 안에서도 null이 아님이 유지된다
                const { linkedNoticeId } = notice;
                const image = (
                  <img
                    src={notice.imageUrl}
                    alt={`공지 ${index + 1}`}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                );

                return (
                  <li key={notice.id} className="h-full w-full shrink-0 snap-center bg-background">
                    {linkedNoticeId === null ? (
                      image
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenNotice(linkedNoticeId)}
                        className="block h-full w-full"
                      >
                        {image}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {multiple && (
              // 이미지 색과 상관없이 읽히도록 반투명 검정 위에 흰 글씨
              <p
                aria-live="polite"
                className="tabular-nums absolute top-3 right-3 rounded-lg bg-gray-900/70 px-2.5 py-1 text-xs font-semibold text-white"
              >
                {current + 1} / {notices.length}
              </p>
            )}
          </div>

          {multiple && (
            <ArrowButton
              direction="next"
              disabled={current === notices.length - 1}
              onClick={() => goTo(current + 1)}
            />
          )}
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={onHideForWeek}
            className="min-h-11 px-2 text-sm text-white/80 transition-[scale] duration-75 active:scale-[0.97]"
          >
            7일간 보지 않기
          </button>
          <span aria-hidden="true" className="h-4 w-px bg-white/40" />
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-2 text-sm font-semibold text-white transition-[scale] duration-75 active:scale-[0.97]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

interface ArrowButtonProps {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}

function ArrowButton({ direction, disabled, onClick }: ArrowButtonProps) {
  const prev = direction === 'prev';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={prev ? '이전 공지' : '다음 공지'}
      className="flex h-11 w-11 shrink-0 items-center justify-center text-white transition-opacity duration-150 disabled:opacity-25"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
        <path
          d={prev ? 'M15 4 7 12l8 8' : 'M9 4l8 8-8 8'}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
