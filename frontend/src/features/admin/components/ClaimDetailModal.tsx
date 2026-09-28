import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { formatDate } from '@/shared/lib/format';
import { formatUserCells } from '@/features/admin/lib/format';
import {
  CLAIM_CATEGORY_LABEL,
  CLAIM_STATUS_LABEL,
  CLAIM_STATUS_ORDER,
  CLAIM_TYPE_LABEL,
  getAdminClaimDetail,
  updateAdminClaim,
  type AdminClaim,
  type ClaimStatus,
} from '@/features/admin/api/adminClaims';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminFieldLabel, AdminTextarea } from '@/features/admin/ui/AdminField';
import { AdminSelect } from '@/features/admin/ui/AdminFilters';
import { AdminModal } from '@/features/admin/ui/AdminModal';

interface ClaimDetailModalProps {
  claim: AdminClaim;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * 03-a 제보 상세 + 상태 변경. 제보 관리(03)와 자전거 상세 제보 탭(07-b)이 같이 쓴다(#157).
 * 저장하면 03-b 토스트는 부모가 띄운다.
 * 처리 내용·사진은 목록 응답에 없어(hasComment만 옴) 상세 API를 따로 조회한다.
 */
export function ClaimDetailModal({ claim, onClose, onSaved }: ClaimDetailModalProps) {
  const queryClient = useQueryClient();
  const [statement, setStatement] = useState<ClaimStatus>(claim.status);
  // 기존 처리 내용은 상세 응답에만 있다 — 사용자가 고치기 전(null)에는 상세 값을 그대로 보여준다
  const [edited, setEdited] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['adminClaimDetail', claim.claimId],
    queryFn: () => getAdminClaimDetail(claim.claimId),
  });
  const content = edited ?? detail.data?.adminComment ?? '';
  const user = formatUserCells(claim.nickname, claim.userId);

  const save = useMutation({
    mutationFn: () => updateAdminClaim(claim.claimId, { statement, content: content.trim() }),
    onSuccess: () => {
      // 어느 화면에서 바꾸든 제보 관리 목록 · 자전거 상세 제보 탭 · 미해결 제보 카드가 함께 맞게
      void queryClient.invalidateQueries({ queryKey: ['adminClaims'] });
      void queryClient.invalidateQueries({ queryKey: ['adminClaimDetail', claim.claimId] });
      void queryClient.invalidateQueries({ queryKey: ['adminCycleClaims'] });
      void queryClient.invalidateQueries({ queryKey: ['adminCycleStatics'] });
      onSaved();
    },
  });

  return (
    <AdminModal
      open
      onClose={onClose}
      title={`제보 상세 CL-${claim.claimId}`}
      size="lg"
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose}>
            취소
          </AdminButton>
          <AdminButton disabled={save.isPending || detail.isPending} onClick={() => save.mutate()}>
            {save.isPending ? '저장 중…' : '저장'}
          </AdminButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <InfoItem label="유형" value={CLAIM_TYPE_LABEL[claim.claimType]} />
          <InfoItem label="자전거" value={claim.cycleId ?? '-'} />
          <InfoItem label="제보자 닉네임" value={user.nickname} />
          <InfoItem label="사용자 ID" value={user.userCode} />
          <InfoItem
            label="부위"
            value={claim.category === null ? '-' : CLAIM_CATEGORY_LABEL[claim.category]}
          />
          <InfoItem label="작성일" value={formatDate(claim.createdAt)} />
        </dl>

        <div className="rounded-md bg-admin-panel px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{claim.content}</p>
          {claim.cycleReportNum > 0 && (
            <p className="mt-2 text-xs text-admin-danger-text">
              허위 제보 신고 {claim.cycleReportNum}건
            </p>
          )}
        </div>

        {detail.isPending && <p className="text-sm text-admin-muted">상세를 불러오는 중…</p>}
        {detail.data?.photoUrl && (
          <img
            src={detail.data.photoUrl}
            alt="제보 사진"
            className="max-h-64 w-fit rounded-md border border-admin-line object-contain"
          />
        )}

        <div className="grid grid-cols-[8rem_1fr] items-center gap-3">
          <span className="text-sm font-medium">처리 상태</span>
          <AdminSelect
            value={statement}
            onChange={(e) => setStatement(e.target.value as ClaimStatus)}
            className="w-40"
            aria-label="처리 상태"
          >
            {CLAIM_STATUS_ORDER.map((key) => (
              <option key={key} value={key}>
                {CLAIM_STATUS_LABEL[key]}
              </option>
            ))}
          </AdminSelect>
        </div>

        <div>
          <AdminFieldLabel label="처리 내용" />
          <AdminTextarea
            className="min-h-24"
            placeholder="처리 결과나 조치 내용을 남겨 주세요 (선택)"
            value={content}
            maxLength={255}
            onChange={(e) => setEdited(e.target.value)}
          />
        </div>

        {save.isError && (
          <p className="text-sm text-admin-danger-text">
            {save.error instanceof ApiError
              ? save.error.message
              : '저장에 실패했습니다. 다시 시도해 주세요.'}
          </p>
        )}
      </div>
    </AdminModal>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-admin-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
