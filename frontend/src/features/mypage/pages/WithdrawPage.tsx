import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { TopHeader } from '@/shared/ui/TopHeader';
import { withdraw } from '@/features/auth/api/auth';
import { getMyClaims } from '@/features/report/api/reports';

/** 탈퇴 사유 선택지 */
const REASONS = [
  '자전거를 잘 이용하지 않아요',
  '예측이 정확하지 않아요',
  '앱이 사용하기 불편해요',
  '개인정보가 걱정돼요',
  '기타',
];

/** 회원 탈퇴 — 삭제 데이터 요약 + 사유 + 동의 후 탈퇴 (와이어프레임 기준) */
export function WithdrawPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState(REASONS[0]);
  const [agreed, setAgreed] = useState(false);

  // 삭제될 데이터 건수 — 실제 보유 데이터에서 조회 (이동 기록 건수는 #20 머지 후 연동 가능)
  const { data: claims } = useQuery({ queryKey: ['myClaims'], queryFn: getMyClaims });

  const mutation = useMutation({
    mutationFn: () => withdraw(reason),
    onSuccess: () => {
      // 계정이 사라졌으므로 캐시를 비우고 처음부터
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  const serverError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? '탈퇴 처리에 실패했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  const deletions = [
    '모든 이동 기록',
    claims ? `내 민원·제보 ${claims.length}건` : '내 민원·제보',
    '계정·닉네임 정보',
  ];

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="회원 탈퇴" />

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 경고 */}
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-3xl font-black text-status-low">
            !
          </span>
          <h2 className="mt-5 text-xl font-bold text-gray-900">정말 탈퇴하시겠어요?</h2>
          <p className="mt-2 text-[15px] text-gray-500">
            탈퇴하면 아래 데이터가 모두 삭제되고 복구할 수 없어요.
          </p>
        </div>

        {/* 삭제 데이터 요약 */}
        <ul className="mt-6 space-y-2.5 rounded-2xl bg-background px-5 py-5">
          {deletions.map((item) => (
            <li key={item} className="tabular-nums flex items-center gap-2.5 text-gray-700">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              {item}
            </li>
          ))}
        </ul>

        {/* 탈퇴 사유 */}
        <h3 className="mt-8 font-bold text-gray-900">탈퇴 사유를 알려주세요</h3>
        <ul className="mt-2">
          {REASONS.map((item) => {
            const selected = reason === item;
            return (
              <li key={item}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="withdraw-reason"
                    checked={selected}
                    onChange={() => setReason(item)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-[border-color] duration-75 ${
                      selected ? 'border-primary' : 'border-gray-300'
                    }`}
                  >
                    {selected && <span className="h-3 w-3 rounded-full bg-primary" />}
                  </span>
                  <span className="text-[16px] text-gray-800">{item}</span>
                </label>
              </li>
            );
          })}
        </ul>

        {/* 동의 */}
        <div className="mt-3">
          <Checkbox checked={agreed} onChange={setAgreed}>
            위 내용을 확인했으며 탈퇴에 동의합니다
          </Checkbox>
        </div>

        {serverError && <p className="mt-3 text-sm text-status-low">{serverError}</p>}
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-3 px-5 pb-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-gray-200 font-semibold text-gray-600 active:bg-gray-50"
        >
          취소
        </button>
        <Button
          className="flex-[1.6] bg-status-low active:bg-red-700"
          disabled={!agreed || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? '처리 중…' : '탈퇴하기'}
        </Button>
      </div>
    </div>
  );
}
