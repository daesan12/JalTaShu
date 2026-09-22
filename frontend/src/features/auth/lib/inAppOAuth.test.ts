import { describe, expect, it } from 'vitest';
import { isOAuthInProgress } from '@/features/auth/lib/inAppOAuth';

describe('인앱 로그인 창을 언제까지 열어 두는가', () => {
  it('카카오 화면과 백엔드 OAuth 경로에서는 기다린다', () => {
    expect(isOAuthInProgress('https://kauth.kakao.com/oauth/authorize?client_id=x')).toBe(true);
    expect(isOAuthInProgress('https://accounts.kakao.com/login')).toBe(true);
    expect(isOAuthInProgress('https://j15b103.p.ssafy.io/staging-auth/oauth/kakao')).toBe(true);
  });

  /**
   * 콜백 응답이 refresh 쿠키를 심는다. 여기서 안 닫으면 백엔드가 성공 URL(스테이징 웹앱)로
   * 보내고, 그 웹앱이 창 안에서 부팅해 앱과 **같은 쿠키로 동시에 재발급**을 친다.
   * 서버는 이미 쓴 토큰이 다시 오면 로그인을 통째로 폐기하므로 로그인하자마자 풀린다.
   */
  it('콜백에 닿으면 성공 URL로 넘어가기 전에 닫는다', () => {
    expect(isOAuthInProgress('https://j15b103.p.ssafy.io/api/auth/oauth/callback/kakao?code=abc')).toBe(false);
  });

  it('성공·실패 URL(프론트 웹)에서는 닫는다', () => {
    expect(isOAuthInProgress('https://j15b103.p.ssafy.io/staging/')).toBe(false);
    expect(isOAuthInProgress('https://j15b103.p.ssafy.io/staging/login')).toBe(false);
  });

  // 카카오톡 앱으로 넘어갔다 돌아오는 흐름에서 앱 스킴이 끼어든다 — 여기서 닫으면 로그인이 끊긴다
  it('앱 스킴·빈 화면·해석 불가 주소에서는 닫지 않는다', () => {
    expect(isOAuthInProgress('kakaotalk://kakaolink?x=1')).toBe(true);
    expect(isOAuthInProgress('intent://open#Intent;scheme=kakaotalk;end')).toBe(true);
    expect(isOAuthInProgress('about:blank')).toBe(true);
    expect(isOAuthInProgress('')).toBe(true);
  });
});
