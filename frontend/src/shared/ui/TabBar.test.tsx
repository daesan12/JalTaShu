// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TabBar } from '@/shared/ui/TabBar';

afterEach(cleanup);

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar />
    </MemoryRouter>,
  );
  return screen.getByRole('navigation', { hidden: true });
}

describe('TabBar', () => {
  it('평소에는 탭을 받는다', () => {
    expect(renderAt('/').className).not.toContain('pointer-events-none');
  });

  /*
   * 경로 단계에서는 시트가 탭바를 덮는다. 시트가 열리고 닫히는 동안 그 자리가 잠깐 비어,
   * 시트 버튼을 연타하면 탭이 탭바로 새어 들어가 엉뚱한 탭으로 넘어갔다.
   */
  it('경로 비교·상세·안내에서는 탭을 받지 않는다', () => {
    for (const path of ['/?routes=1', '/?routes=1&detail=1', '/?routes=1&detail=1&guide=1']) {
      cleanup();
      expect(renderAt(path).className).toContain('pointer-events-none');
    }
  });

  it('지도가 아닌 화면에서는 같은 파라미터라도 막지 않는다', () => {
    expect(renderAt('/report?routes=1').className).not.toContain('pointer-events-none');
  });
});
