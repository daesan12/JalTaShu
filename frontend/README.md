# 잘타슈 Frontend

React + Vite + Tailwind CSS v4 모바일 웹앱. 이후 Capacitor로 래핑해 Android 앱으로 배포 예정.

## 시작하기

```bash
npm install
cp .env.example .env.local   # 값 채우기 (msw만 쓸 거면 그대로 OK)
npm run dev
```

`VITE_ENABLE_MSW=true`면 백엔드 없이 가짜 API(msw)로 개발할 수 있다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (기본 http://localhost:5173) |
| `npm run build` | 타입체크 + 프로덕션 빌드 |
| `npm run lint` | oxlint 검사 |
| `npm test` | Vitest 유닛 테스트 (감시 모드: `npm run test:watch`) |
| `npm run preview` | 빌드 결과 로컬 확인 |

## 안드로이드 디버그 APK

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`.env.local`을 실서버 설정으로 두고 빌드해야 스테이징에 붙는다(msw는 꺼야 한다).

**디버그 서명 키는 팀이 공유한다**(`android/app/shared-debug.keystore`).
안드로이드 기본 디버그 키는 PC마다 다르게 만들어져서, 그대로 두면 다른 팀원이 설치한 폰에
덮어쓸 수 없고(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) 매번 지웠다 깔아야 한다 — 로그인도 풀린다.
키를 고정해 두었으니 누가 빌드하든 `adb install -r`로 덮어쓰면 된다.

키를 바꾼 뒤 **처음 한 번은** 기존 앱과 서명이 달라 설치가 거부된다. 그때만 지우고 깐다:

```bash
adb uninstall com.ssafy.zaltashu
```

이 키는 **디버그 전용**이다. 스토어 배포용 키는 저장소에 넣지 않는다.

## 폴더 구조

```
src/
├─ app/          # 라우터, Provider, 전역 CSS(디자인 토큰)
├─ shared/
│  ├─ ui/        # Figma 공통 컴포넌트 12종 (BottomSheet 포함)
│  ├─ api/       # axios 클라이언트 + API 타입 (ApiResponse 언랩)
│  ├─ lib/       # 좌표 변환, QR 추출, 포맷터 (순수 함수)
│  └─ config/    # env 래퍼, 상수
├─ features/
│  ├─ map/       # 07~16 지도·경로 (만두)
│  ├─ rental/    # 17~18 QR·자전거 (경호)
│  ├─ history/   # 22~23 기록 (경호)
│  ├─ mypage/    # 24~34 프로필·이용안내 (경호)
│  ├─ auth/ onboarding/ report/  # 01~06, 19~21 (경호)
│  └─ admin/     # 관리자 웹 — 라우터 lazy로 별도 청크 분리
└─ mocks/        # msw 가짜 API 핸들러
```

## 규칙

- **모바일 전용**: 최대 폭 430px (`MobileLayout`), 높이는 `100vh` 금지 → `dvh` 사용, 터치 타깃 44px+
- **디자인 토큰**: 색상은 `src/app/index.css`의 `@theme` 변수만 사용 (`bg-primary`, `text-status-low` 등). `brand/primary(#4c8a12)` 외에는 근사값이라 Figma 확정 시 값만 교체
- **좌표 순서**: OSRM은 `[경도,위도]`, 네이버는 `(위도,경도)` — 반드시 `shared/lib/coords.ts` 변환 함수 사용
- **API**: `shared/api/client.ts`의 `apiGet` 등만 사용 (`{code, message, data}` 래퍼 자동 언랩)
- **바텀시트**: 새 페이지 만들지 말고 `shared/ui/BottomSheet`의 `snapPoint`(peek/mini/half/tall) 전환으로 구현
