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
| `npm run preview` | 빌드 결과 로컬 확인 |

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
