import { Capacitor } from '@capacitor/core';

/** 프롬프트가 안 뜨거나 사용자가 무시해도 흐름이 멈추지 않게 상한을 건다 */
const PROMPT_TIMEOUT_MS = 15_000;

function withTimeout(promise: Promise<unknown>): Promise<unknown> {
  const timeout = new Promise((resolve) => setTimeout(resolve, PROMPT_TIMEOUT_MS));
  return Promise.race([promise, timeout]);
}

/**
 * 온보딩 03에서 위치 → 카메라 → 알림 순서로 권한 팝업을 차례로 띄운다.
 * 거부·무응답·미지원이어도 다음으로 진행 (알림은 선택, 위치·카메라도 사용 시점에 재요청 가능).
 *
 * 앱(Capacitor)에서는 안드로이드 시스템 권한 팝업, 웹에서는 브라우저 권한 팝업.
 * 앱에서 한 번 허용되면 이후 WebView의 navigator.geolocation / getUserMedia는
 * Capacitor 브리지가 그대로 통과시키므로 나머지 코드는 웹 API를 계속 쓰면 된다.
 */
export async function requestPermissionsSequentially(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    return requestNativePermissions();
  }
  return requestWebPermissions();
}

/** 안드로이드 시스템 권한 요청 — 플러그인은 앱에서만 필요하므로 동적 import */
async function requestNativePermissions(): Promise<void> {
  const [{ Geolocation }, { Camera }, { LocalNotifications }] = await Promise.all([
    import('@capacitor/geolocation'),
    import('@capacitor/camera'),
    import('@capacitor/local-notifications'),
  ]);

  // 1. 위치 — 기기 위치 서비스가 꺼져 있으면 throw하므로 무시하고 진행
  await withTimeout(Geolocation.requestPermissions().catch(() => undefined));

  // 2. 카메라 — QR 스캔·민원 사진용 (갤러리 photos 권한은 요청하지 않음)
  await withTimeout(Camera.requestPermissions({ permissions: ['camera'] }).catch(() => undefined));

  // 3. 알림 (Android 13+ POST_NOTIFICATIONS, 이하 버전은 즉시 granted)
  await withTimeout(LocalNotifications.requestPermissions().catch(() => undefined));
}

/** 브라우저 권한 요청 — 기존 웹 동작 그대로 */
async function requestWebPermissions(): Promise<void> {
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
