import { useEffect, useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Chip } from '@/shared/ui/Chip';
import {
  REPORT_CONTENT_MAX,
  REPORT_TAGS,
  submitReport,
  type ReportTag,
  type ReportType,
} from '@/features/report/api/reports';

const BIKE_CODE_PATTERN = /^[A-Za-z0-9]{6,12}$/;

/** 제목 옆 필수·선택 표시 — 제목보다 작고 연하게 (본문 대비는 유지) */
function FieldMark({ children }: { children: string }) {
  return <span className="ml-1 text-sm font-medium text-gray-500">{children}</span>;
}

interface ReportFormProps {
  type: ReportType;
  /** 스캔에서 돌아올 때 ?code=로 전달된 자전거 코드 */
  initialCode: string;
  /** 스캔 화면으로 이동 (현재 type 유지) */
  onScan: () => void;
}

/** 17-1 고장신고 · 17-2 방치신고 · 17-3 기타문의 공용 폼 */
export function ReportForm({ type, initialCode, onScan }: ReportFormProps) {
  const navigate = useNavigate();
  const [bikeCode, setBikeCode] = useState(initialCode);
  const [noQr, setNoQr] = useState(false); // 17-2 전용: QR 스캔이 어려운 경우
  const [tag, setTag] = useState<ReportTag | null>(null); // 17-1 전용: 고장 부위
  const [tagDetail, setTagDetail] = useState(''); // '기타' 선택 시 직접 입력
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bikeErrorId = useId();

  // 사진이 바뀌거나 화면을 떠날 때 이전 미리보기 URL 반납
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.preview);
  }, [photo]);

  const needsBike = type !== 'inquiry';
  const showPhoto = type !== 'inquiry';
  const needsTag = type === 'broken'; // 부위 태그는 고장신고 전용 (자전거 다이어그램 재료)

  const mutation = useMutation({
    mutationFn: () =>
      submitReport({
        type,
        bikeCode: needsBike && !noQr ? bikeCode : null,
        tag: needsTag ? tag : null,
        tagDetail: needsTag && tag === '기타' ? tagDetail.trim() : null,
        content: content.trim(),
        photoName: photo?.file.name ?? null,
      }),
    onSuccess: () => navigate('/report/my'),
  });

  const bikeOk = !needsBike || noQr || BIKE_CODE_PATTERN.test(bikeCode);
  // 입력을 시작한 뒤에만 형식 오류를 알린다 — 빈 칸부터 빨갛게 만들지 않도록
  const bikeCodeError =
    needsBike && !noQr && bikeCode.length > 0 && !bikeOk
      ? '영문·숫자 6~12자로 입력해 주세요.'
      : null;
  // '기타'는 문제 부위를 직접 입력해야 함
  const tagOk = !needsTag || (tag !== null && (tag !== '기타' || tagDetail.trim().length > 0));
  const canSubmit = bikeOk && tagOk && content.trim().length > 0 && !mutation.isPending;

  const serverError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? '접수에 실패했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return (
    <div className="mt-6 space-y-6">
      {needsBike && (
        <section>
          <h2 className="text-[17px] font-bold text-gray-900">
            신고할 자전거
            <FieldMark>(필수)</FieldMark>
          </h2>
          <div
            className={`mt-3 flex min-h-14 items-center gap-2 rounded-2xl border bg-surface px-4 ${
              bikeCodeError ? 'border-status-low' : 'border-gray-200'
            }`}
          >
            <input
              value={bikeCode}
              onChange={(e) => setBikeCode(e.target.value.trim().toUpperCase())}
              placeholder="QR코드를 스캔해주세요."
              disabled={noQr}
              aria-invalid={bikeCodeError ? true : undefined}
              aria-describedby={bikeCodeError ? bikeErrorId : undefined}
              className="min-w-0 flex-1 bg-transparent text-base placeholder-gray-400 focus:outline-none disabled:opacity-40"
            />
            <button
              type="button"
              onClick={onScan}
              disabled={noQr}
              className="flex min-h-11 shrink-0 items-center gap-1.5 px-1 font-semibold text-primary disabled:opacity-40"
            >
              <span className="h-4.5 w-4.5 rounded border-2 border-primary" aria-hidden />
              스캔
            </button>
          </div>
          {bikeCodeError && (
            <p id={bikeErrorId} className="mt-1.5 text-sm text-status-low">
              {bikeCodeError}
            </p>
          )}
          {type === 'abandoned' && (
            <div className="mt-2">
              <Checkbox checked={noQr} onChange={setNoQr}>
                <span className="text-[15px] font-medium text-primary">
                  QR코드 스캔이 어려우시면 선택해주세요!
                </span>
              </Checkbox>
            </div>
          )}
        </section>
      )}

      {needsTag && (
        <section>
          <h2 className="text-[17px] font-bold text-gray-900">
            어떤 문제인가요?
            <FieldMark>(필수, 1개 선택)</FieldMark>
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {REPORT_TAGS.map((t) => (
              <Chip key={t} selected={tag === t} onClick={() => setTag(t)}>
                {t}
              </Chip>
            ))}
          </div>
          {tag === '기타' && (
            <input
              value={tagDetail}
              onChange={(e) => setTagDetail(e.target.value)}
              placeholder="어떤 문제인지 직접 입력해주세요 (예: 벨, 바구니)"
              maxLength={10}
              className="mt-3 min-h-12 w-full rounded-xl border border-gray-200 bg-surface px-4 text-base placeholder-gray-400 focus:border-primary focus:outline-none"
            />
          )}
        </section>
      )}

      {showPhoto && (
        <section>
          <h2 className="text-[17px] font-bold text-gray-900">
            사진 촬영
            <FieldMark>(선택)</FieldMark>
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-status-low">
            ※ 고장으로 반납이 불가능한 경우, 거치대와 자전거가 모두 보이도록 촬영해 주세요.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setPhoto(file ? { file, preview: URL.createObjectURL(file) } : null);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 flex h-56 w-full items-center justify-center overflow-hidden rounded-2xl bg-background active:bg-gray-100"
            aria-label="사진 촬영 또는 선택"
          >
            {photo ? (
              <img src={photo.preview} alt="첨부한 사진 미리보기" className="h-full w-full object-cover" />
            ) : (
              // 카메라 아이콘 자리
              <svg viewBox="0 0 24 24" className="h-12 w-12 text-gray-300" fill="currentColor">
                <path d="M4 7h3l1.2-2h7.6L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              </svg>
            )}
          </button>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-bold text-gray-900">
            상세내용
            <FieldMark>(필수)</FieldMark>
          </h2>
          <span className="text-sm text-gray-400 tabular-nums">
            {content.length}/{REPORT_CONTENT_MAX}
          </span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력해주세요."
          rows={type === 'inquiry' ? 10 : 5}
          maxLength={REPORT_CONTENT_MAX}
          className="mt-3 w-full resize-none rounded-2xl border border-gray-200 bg-surface px-4 py-3.5 text-base placeholder-gray-400 focus:border-primary focus:outline-none"
        />
      </section>

      {serverError && <p className="text-sm text-status-low">{serverError}</p>}

      <Button full disabled={!canSubmit} onClick={() => mutation.mutate()}>
        {mutation.isPending ? '접수 중…' : '확인'}
      </Button>
    </div>
  );
}
