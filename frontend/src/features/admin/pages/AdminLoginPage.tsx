import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router';
import { adminLogin } from '@/features/admin/api/adminAuth';
import { ADMIN_SESSION_QUERY_KEY, useAdminAuth } from '@/features/admin/hooks/useAdminAuth';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { ADMIN_FIELD_FRAME } from '@/features/admin/ui/AdminField';
import { ApiError } from '@/shared/api/client';

/** Figma 10-a의 문구. 서버가 무슨 말을 하든 자격 증명 실패는 이 문장으로 통일한다 */
const CREDENTIAL_ERROR = '아이디 또는 비밀번호가 올바르지 않습니다.';

/** 입력칸은 Figma 기준 44px. 테두리·포커스는 다른 관리자 입력칸과 같은 껍데기 */
const FIELD = `h-11 w-full px-3.5 ${ADMIN_FIELD_FRAME}`;

/** 10 관리자 로그인 (오류 상태는 10-a) */
export function AdminLoginPage() {
  const { isPending, isLoggedIn } = useAdminAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 이미 로그인한 채로 들어오면 히트맵으로
  if (!isPending && isLoggedIn) return <Navigate to="/admin" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminLogin(id, password);
      // 방금 로그인해 세션이 확실하므로 refresh를 다시 치지 않고 바로 반영한다
      queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, true);
      navigate('/admin', { replace: true });
    } catch (err) {
      // 401은 자격 증명 실패, 그 밖(네트워크 등)은 원래 메시지를 그대로 보여준다
      const isCredential = err instanceof ApiError && err.code === 401;
      setError(isCredential || !(err instanceof ApiError) ? CREDENTIAL_ERROR : err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-admin-panel">
      <form
        onSubmit={handleSubmit}
        className="w-100 rounded-xl border border-admin-line bg-admin-bg p-10 text-admin-text"
      >
        <h1 className="text-[22px] font-semibold">타슈 관리자</h1>
        <p className="mt-2 text-sm text-admin-muted">관리자 계정으로 로그인하세요</p>

        <label className="mt-7 block text-sm font-medium" htmlFor="admin-id">
          아이디
        </label>
        <input
          id="admin-id"
          className={`mt-1.5 ${FIELD}`}
          value={id}
          onChange={(event) => setId(event.target.value)}
          autoComplete="username"
          required
        />

        <label className="mt-5 block text-sm font-medium" htmlFor="admin-password">
          비밀번호
        </label>
        <input
          id="admin-password"
          type="password"
          className={`mt-1.5 ${FIELD}`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error && (
          <p role="alert" className="mt-4 text-sm text-admin-danger-text">
            {error}
          </p>
        )}

        <AdminButton type="submit" size="lg" full className="mt-6" disabled={submitting}>
          {submitting ? '로그인 중…' : '로그인'}
        </AdminButton>
      </form>
    </div>
  );
}
