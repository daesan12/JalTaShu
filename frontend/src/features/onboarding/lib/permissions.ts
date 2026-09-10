/** 프롬프트가 안 뜨거나 사용자가 무시해도 흐름이 멈추지 않게 상한을 건다 */
const PROMPT_TIMEOUT_MS = 15_000;

function withTimeout(promise: Promise<unknown>): Promise<unknown> {
  const timeout = new Promise((resolve) => setTimeout(resolve, PROMPT_TIMEOUT_MS));
  return Promise.race([promise, timeout]);
}

/**
 * 온보딩 03에서 위치 → 카메라 → 알림 순서로 권한 팝업을 차례로 띄운다.
 * 거부·무응답·미지원이어도 다음으로 진행 (알림은 선택, 위치·카메라도 사용 시점에 재요청 가능).
 */
export async function requestPermissionsSequentially(): Promise<void> {
  // 1. 위치 — 성공/거부 모두 resolve해서 다음으로 진행
  await withTimeout(
    new Promise<void>((resolve) => {
      if (!navigator.geolocation) return resolve();
      navigator.geolocation.getCurrentPosition(
        () => resolve(),
        () => resolve(),
        { timeout: 10_000 },
      );
    }),
  );

  // 2. 카메라 — 권한만 얻고 스트림은 즉시 반납
  await withTimeout(
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((stream) => stream.getTracks().forEach((track) => track.stop()))
      .catch(() => {
        // 거부·미지원 무시
      }) ?? Promise.resolve(),
  );

  // 3. 알림
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      await withTimeout(Notification.requestPermission());
    }
  } catch {
    // 미지원 무시
  }
}
