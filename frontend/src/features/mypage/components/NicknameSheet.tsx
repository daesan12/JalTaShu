import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { NICKNAME_MAX, NICKNAME_MIN, NICKNAME_PATTERN } from '@/shared/config/constants';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { InputField } from '@/shared/ui/InputField';
import { updateNickname } from '@/features/auth/api/auth';
import { ME_QUERY_KEY } from '@/features/auth/hooks/useAuth';

interface NicknameSheetProps {
  open: boolean;
  currentNickname: string;
  onClose: () => void;
}

/** 닉네임 변경 바텀시트 — 가입(06)과 동일한 규칙(2~10자, 한글·영문·숫자) */
export function NicknameSheet({ open, currentNickname, onClose }: NicknameSheetProps) {
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState(currentNickname);

  const mutation = useMutation({
    mutationFn: () => updateNickname(nickname),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      onClose();
    },
  });

  const error =
    nickname.length > 0 &&
    (nickname.length < NICKNAME_MIN ||
      nickname.length > NICKNAME_MAX ||
      !NICKNAME_PATTERN.test(nickname))
      ? `${NICKNAME_MIN}~${NICKNAME_MAX}자, 한글·영문·숫자만 사용할 수 있어요.`
      : null;
  const canSave =
    !error && nickname.length >= NICKNAME_MIN && nickname !== currentNickname && !mutation.isPending;

  const serverError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? '변경에 실패했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return (
    <BottomSheet open={open} snapPoint="mini" onClose={onClose} backdrop>
      <h2 className="text-[17px] font-bold text-gray-900">닉네임 변경</h2>
      <div className="mt-3 flex items-start gap-2">
        <InputField
          className="flex-1"
          value={nickname}
          maxLength={NICKNAME_MAX}
          onChange={(e) => setNickname(e.target.value.trim())}
          error={error ?? serverError ?? undefined}
        />
        <Button disabled={!canSave} onClick={() => mutation.mutate()}>
          {mutation.isPending ? '저장 중…' : '저장'}
        </Button>
      </div>
    </BottomSheet>
  );
}
