import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router';
import { ApiError } from '@/shared/api/client';
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_PATTERN,
  TERMS,
  type TermCode,
} from '@/shared/config/constants';
import { Button } from '@/shared/ui/Button';
import { Checkbox } from '@/shared/ui/Checkbox';
import { InputField } from '@/shared/ui/InputField';
import { TopHeader } from '@/shared/ui/TopHeader';
import { signUp } from '@/features/auth/api/auth';
import { ME_QUERY_KEY, useAuth } from '@/features/auth/hooks/useAuth';

function validateNickname(nickname: string): string | null {
  if (nickname.length === 0) return null; // 입력 전에는 에러를 보여주지 않는다
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자여야 해요.`;
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return '한글·영문·숫자만 사용할 수 있어요. (공백·특수문자 불가)';
  }
  return null;
}

/** 06 약관 동의 + 닉네임 설정 */
export function SignupPage() {
  const { isPending, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [agreed, setAgreed] = useState<Set<TermCode>>(new Set());
  const [nickname, setNickname] = useState('');

  const mutation = useMutation({
    mutationFn: () => signUp([...agreed], nickname),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      navigate('/', { replace: true });
    },
  });

  // 로그인 없이 직접 접근하면 로그인으로
  if (!isPending && !isLoggedIn) return <Navigate to="/login" replace />;

  const allAgreed = TERMS.every((t) => agreed.has(t.code));
  const requiredAgreed = TERMS.filter((t) => t.required).every((t) => agreed.has(t.code));
  const nicknameError = validateNickname(nickname);
  const canSubmit =
    requiredAgreed && nickname.length >= NICKNAME_MIN && !nicknameError && !mutation.isPending;

  const toggleAll = (checked: boolean) => {
    setAgreed(checked ? new Set(TERMS.map((t) => t.code)) : new Set());
  };

  const toggleOne = (code: TermCode, checked: boolean) => {
    setAgreed((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const serverError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? '가입에 실패했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return (
    <div className="flex flex-1 flex-col">
      <TopHeader title="약관 동의" showBack={false} />

      <div className="flex-1 overflow-y-auto px-5">
        {/* 전체 동의 */}
        <div className="mt-2 rounded-2xl bg-background px-4">
          <Checkbox checked={allAgreed} onChange={toggleAll}>
            <span className="font-semibold">약관 전체에 동의합니다</span>
          </Checkbox>
        </div>

        {/* 개별 약관 */}
        <ul className="mt-2 px-4">
          {TERMS.map((term) => (
            <li key={term.code}>
              <Checkbox
                checked={agreed.has(term.code)}
                onChange={(checked) => toggleOne(term.code, checked)}
              >
                <span className={term.required ? 'text-gray-800' : 'text-gray-500'}>
                  [{term.required ? '필수' : '선택'}] {term.label}
                </span>
              </Checkbox>
            </li>
          ))}
        </ul>

        {/* 닉네임 */}
        <div className="mt-6">
          <InputField
            label="닉네임"
            placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자, 한글·영문·숫자`}
            value={nickname}
            maxLength={NICKNAME_MAX}
            onChange={(e) => setNickname(e.target.value.trim())}
            error={nicknameError ?? undefined}
          />
          <p className="mt-1.5 text-xs text-gray-400">다른 사용자에게 제보 작성자로 표시돼요.</p>
        </div>

        {serverError && <p className="mt-4 text-sm text-status-low">{serverError}</p>}
      </div>

      <div className="pb-safe px-5 pb-6 pt-3">
        <Button full disabled={!canSubmit} onClick={() => mutation.mutate()}>
          {mutation.isPending ? '가입 중…' : '동의하고 시작하기'}
        </Button>
      </div>
    </div>
  );
}
