/** 타슈 QR 페이로드에서 자전거 코드 추출 (예: https://me2.do/XXXX?TASHU_22B01262 → "22B01262") */
const TASHU_QR_PATTERN = /TASHU[_-]?([A-Za-z0-9]+)/i;

export function extractTashuCode(payload: string): string | null {
  const match = TASHU_QR_PATTERN.exec(payload);
  return match ? match[1] : null;
}
