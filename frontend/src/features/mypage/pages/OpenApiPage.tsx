import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { formatTimeAgo } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { TopHeader } from '@/shared/ui/TopHeader';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  getOpenApiRequests,
  OPEN_API_PURPOSES,
  submitOpenApiRequest,
} from '@/features/mypage/api/openApi';

const TABS = ['Open API 신청', '신청 내역'] as const;

/** Open API (자전거 정보 하위) — 신청 폼 + 신청 내역 (타슈 앱 구성) */
export function OpenApiPage() {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [tabIndex, setTabIndex] = useState(0);
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(false);

  const { data: requests } = useQuery({
    queryKey: ['openApiRequests'],
    queryFn: getOpenApiRequests,
  });

  const mutation = useMutation({
    mutationFn: () => submitOpenApiRequest({ purpose, reason: reason.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['openApiRequests'] });
      setPurpose('');
      setReason('');
      setTabIndex(1); // 접수 확인을 위해 신청 내역으로 이동
    },
  });

  const canSubmit = purpose !== '' && reason.trim().length > 0 && !mutation.isPending;
  const serverError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? '신청에 실패했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="Open API" />

      {/* 탭 바 */}
      <div role="tablist" className="flex border-b border-gray-100">
        {TABS.map((label, i) => {
          const active = i === tabIndex;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTabIndex(i)}
              className={`min-h-12 flex-1 border-b-2 text-[15px] transition-[color,border-color] duration-150 ${
                active
                  ? 'border-primary font-bold text-primary'
                  : 'border-transparent font-medium text-gray-400 active:text-gray-500'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tabIndex === 0 ? (
        <div className="flex-1 overflow-y-auto pb-8">
          {/* 안내 배너 */}
          <div className="bg-primary-light/60 px-5 py-6">
            <p className="leading-relaxed text-gray-600">
              오픈API란 누구나 사용할 수 있도록 공개된 API를 말합니다. 데이터를 표준화하고
              프로그래밍해 외부 소프트웨어 개발자나 사용자들과 공유하는 프로그램입니다.
            </p>
            <Button full variant="line" className="mt-5 rounded-full" onClick={() => setNotice(true)}>
              타슈2 Open API 설명 보기
            </Button>
            {notice && (
              <p className="mt-3 text-center text-sm text-gray-400">설명 문서 연결을 준비 중이에요.</p>
            )}
          </div>

          <div className="px-5">
            {/* 잘타슈는 전화번호를 수집하지 않아 신청자 표시는 닉네임으로 대체 */}
            <h2 className="mt-6 text-[17px] font-bold text-gray-900">신청자</h2>
            <p className="mt-2 font-bold text-primary">{me?.nickname ?? '–'}</p>

            <h2 className="mt-6 text-[17px] font-bold text-gray-900">활용구분</h2>
            <div className="relative mt-3">
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                aria-label="활용구분"
                className={`min-h-13 w-full appearance-none rounded-2xl border border-gray-200 bg-surface px-4 focus:border-primary focus:outline-none ${
                  purpose ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <option value="" disabled>
                  활용구분 용도를 선택해주세요
                </option>
                {OPEN_API_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                aria-hidden
              >
                <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h2 className="mt-6 text-[17px] font-bold text-gray-900">신청사유</h2>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="내용을 입력해주세요."
              rows={7}
              className="mt-3 w-full resize-none rounded-2xl border border-gray-200 bg-surface px-4 py-3.5 text-base placeholder-gray-400 focus:border-primary focus:outline-none"
            />

            {serverError && <p className="mt-2 text-sm text-status-low">{serverError}</p>}

            <Button full className="mt-5" disabled={!canSubmit} onClick={() => mutation.mutate()}>
              {mutation.isPending ? '신청 중…' : '확인'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {requests && requests.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center pb-20 text-gray-300">
              <svg viewBox="0 0 48 48" className="h-24 w-24" fill="none" aria-hidden>
                <path d="M12 6h18l8 8v28H12V6Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                <path d="M18 20h12M18 27h12M18 34h7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p className="mt-4 text-[15px] text-gray-400">조회된 내역이 없어요.</p>
            </div>
          )}
          {requests && requests.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {requests.map((request) => (
                <li key={request.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{request.purpose}</span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{request.reason}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatTimeAgo(request.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
