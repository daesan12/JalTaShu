import { describe, expect, it } from 'vitest';
import { extractTashuCode } from '@/shared/lib/qr';

describe('extractTashuCode', () => {
  it('실물 QR 페이로드(me2.do 링크)에서 코드를 추출한다', () => {
    expect(extractTashuCode('https://me2.do/XXXX?TASHU_22B01262')).toBe('22B01262');
  });

  it('구분자가 하이픈이거나 없어도 추출한다', () => {
    expect(extractTashuCode('TASHU-22B01262')).toBe('22B01262');
    expect(extractTashuCode('TASHU22B01262')).toBe('22B01262');
  });

  it('대소문자를 구분하지 않는다', () => {
    expect(extractTashuCode('tashu_22b01262')).toBe('22b01262');
  });

  it('타슈 QR이 아니면 null을 반환한다', () => {
    expect(extractTashuCode('https://example.com/other-qr')).toBeNull();
    expect(extractTashuCode('')).toBeNull();
  });
});
