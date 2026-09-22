import { describe, expect, it } from 'vitest';
import { getPageItems } from '@/shared/lib/pagination';

describe('getPageItems', () => {
  it('첫 페이지: 1 2 3 … 8 (프레임 기준)', () => {
    expect(getPageItems(1, 8)).toEqual([1, 2, 3, '…', 8]);
  });

  it('중간 페이지: 양쪽에 말줄임', () => {
    expect(getPageItems(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
  });

  it('말줄임이 숫자 하나만 가리게 되면 숫자를 그대로 보여준다', () => {
    expect(getPageItems(5, 8)).toEqual([1, '…', 4, 5, 6, 7, 8]);
  });

  it('마지막 페이지: 1 … 6 7 8', () => {
    expect(getPageItems(8, 8)).toEqual([1, '…', 6, 7, 8]);
  });

  it('간격이 1칸이면 말줄임 대신 숫자를 채운다', () => {
    expect(getPageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('페이지가 적으면 전부 표시', () => {
    expect(getPageItems(2, 3)).toEqual([1, 2, 3]);
    expect(getPageItems(1, 1)).toEqual([1]);
    expect(getPageItems(1, 0)).toEqual([]);
  });
});
