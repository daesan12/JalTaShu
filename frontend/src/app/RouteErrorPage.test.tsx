// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { NotFoundPage, RouteErrorPage } from '@/app/RouteErrorPage';

/** 전역 에러 화면 — 청크 로드 실패(배포 직후)와 일반 오류를 다르게 안내하는 분기를 잠근다 */

afterEach(cleanup);

function renderWithError(error: Error) {
  const router = createMemoryRouter([
    {
      path: '/',
      errorElement: <RouteErrorPage />,
      loader: () => {
        throw error;
      },
      element: <p>본문</p>,
    },
  ]);
  render(<RouterProvider router={router} />);
}

describe('RouteErrorPage', () => {
  it('청크 로드 실패면 새 버전 안내로 구분한다', async () => {
    renderWithError(
      new Error('Failed to fetch dynamically imported module: /assets/AdminUserPage-x.js'),
    );
    expect(await screen.findByText('새 버전이 배포되었어요')).toBeTruthy();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeTruthy();
  });

  it('그 밖의 오류는 일반 안내를 보여준다', async () => {
    renderWithError(new Error('boom'));
    expect(await screen.findByText('문제가 발생했어요')).toBeTruthy();
    expect(screen.getByText('처음 화면으로').getAttribute('href')).toBe('/');
  });
});

describe('NotFoundPage', () => {
  it('등록되지 않은 경로에서 404 안내와 홈 링크를 보여준다', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>홈</p> },
        { path: '*', element: <NotFoundPage /> },
      ],
      { initialEntries: ['/no-such-page'] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('페이지를 찾을 수 없어요')).toBeTruthy();
    expect(screen.getByText('처음 화면으로').getAttribute('href')).toBe('/');
  });
});
