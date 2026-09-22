import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  useScroll,
  useMotionValueEvent,
  useTransform,
  useReducedMotion,
  useInView,
  AnimatePresence,
} from 'framer-motion';
import './installLanding.css';

const installScreen = (filename: string) =>
  `${import.meta.env.BASE_URL}install/screens/${filename}`;

const media = { hero: installScreen('home-map.jpg') };

const appHref = import.meta.env.BASE_URL;
const times = ['현재', '5분 뒤', '10분 뒤', '15분 뒤'];
const examples = [8, 6, 5, 3];

function Bike({ large = false }: { large?: boolean }) {
  return (
    <svg
      viewBox="0 0 160 110"
      fill="none"
      aria-hidden="true"
      className={large ? 'jt-bike large' : 'jt-bike'}
    >
      <circle cx="37" cy="76" r="27" fill="#fff" stroke="currentColor" strokeWidth="5" />
      <circle cx="127" cy="76" r="27" fill="#fff" stroke="currentColor" strokeWidth="5" />
      <path
        d="m37 76 26-48 29 48H37l34-32h43m-22 32 22-32 13 32m-13-32-8-23h15M54 28h22"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="92" cy="76" r="6" fill="currentColor" />
      <path d="m92 76 9 9h9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function RouteBike({ gentle }: { gentle: boolean }) {
  const animation = useRef<SVGAnimateMotionElement>(null);
  const ref = useRef<SVGGElement>(null);
  const visible = useInView(ref, { amount: 0.2 });
  const reduced = useReducedMotion();
  const d = gentle
    ? 'M70 280C250 340 350 295 520 305S750 260 810 265 950 320 1030 140'
    : 'M70 280C240 280 270 65 460 160S620 75 790 165 960 200 1030 140';
  useEffect(() => {
    if (!reduced && visible) animation.current?.beginElement();
  }, [gentle, reduced, visible]);
  return (
    <g ref={ref}>
      <path id="jt-selected-route" d={d} fill="none" stroke="none" />
      <g transform={reduced ? 'translate(70 280)' : undefined}>
        {!reduced && (
          <animateMotion
            ref={animation}
            begin="indefinite"
            key={d}
            dur="4s"
            fill="freeze"
            path={d}
          />
        )}
        <circle r="27" fill="white" stroke="#dae2cf" />
        <g transform="translate(-21,-17) scale(.26)" color="#4c8a12">
          <circle cx="37" cy="76" r="27" fill="none" stroke="currentColor" strokeWidth="6" />
          <circle cx="127" cy="76" r="27" fill="none" stroke="currentColor" strokeWidth="6" />
          <path
            d="m37 76 26-48 29 48H37l34-32h43m-22 32 22-32 13 32m-13-32-8-23h15M54 28h22"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
}

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
const featureScreens = {
  forecast: [{ title: '시간별 예상 자전거 수', src: installScreen('station-forecast.jpg') }],
  route: [
    { title: '경로 후보 비교', src: installScreen('route-compare.jpg') },
    { title: '경사도와 경로 상세', src: installScreen('route-elevation.jpg') },
    { title: '도보·자전거 구간 안내', src: installScreen('route-segments.jpg') },
  ],
  map: [
    { title: '주변 대여소 확인', src: installScreen('home-map.jpg') },
    { title: '장소 선택과 경로 찾기', src: installScreen('place-selected.jpg') },
  ],
  bikeStatus: [{ title: 'QR로 확인한 자전거 상태', src: installScreen('bike-status.jpg') }],
  navigation: [{ title: '주행 중 음성 길 안내', src: installScreen('voice-navigation.jpg') }],
};
function MediaSlot({ name, label }: { name: keyof typeof featureScreens; label: string }) {
  const [active, setActive] = useState(0);
  const screens = featureScreens[name];
  // Ignore layout-induced pointer events while the selected card moves forward.
  const hoverPosition = useRef({ x: -1000, y: -1000, changedAt: 0 });
  return (
    <figure
      className={'jt-screen-gallery gallery-' + name + (screens.length > 1 ? ' has-stack' : '')}
      data-media-slot={name}
      aria-label={label}
    >
      <div className="jt-portrait-stack">
        {screens.map((screen, index) => {
          const depth = (index - active + screens.length) % screens.length;
          return (
            <div
              key={screen.title}
              className={'jt-portrait-card depth-' + depth}
              onPointerMove={(event) => {
                if (event.pointerType !== 'mouse' || depth === 0 || screens.length < 2) return;
                const previous = hoverPosition.current;
                if (
                  performance.now() - previous.changedAt < 500 ||
                  Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 8
                )
                  return;
                hoverPosition.current = {
                  x: event.clientX,
                  y: event.clientY,
                  changedAt: performance.now(),
                };
                setActive(index);
              }}
            >
              <div className="jt-portrait-screen" aria-hidden={depth !== 0}>
                {screen.src ? (
                  <img src={screen.src} alt={screen.title} loading="lazy" />
                ) : (
                  <div className="jt-media-empty">
                    <span className="jt-media-symbol" aria-hidden="true">
                      {name === 'route' ? '⌁' : name === 'navigation' ? '↱' : '⌖'}
                    </span>
                    <strong>{screen.title}</strong>
                    <span>세로 앱 화면 준비 중</span>
                    <small>사진 · GIF</small>
                  </div>
                )}
                <i className="jt-camera" aria-hidden="true" />
              </div>
              {screens.length > 1 && (
                <button
                  type="button"
                  className="jt-card-pick"
                  aria-label={screen.title + ' 앞으로 보기'}
                  aria-pressed={depth === 0}
                  tabIndex={-1}
                  onClick={() => setActive(index)}
                />
              )}
            </div>
          );
        })}
      </div>
      {screens.length > 1 ? (
        <div className="jt-screen-select" role="group" aria-label={label + ' 선택'}>
          {screens.map((screen, index) => (
            <button
              key={screen.title}
              onClick={() => setActive(index)}
              aria-pressed={index === active}
            >
              <span>0{index + 1}</span>
              {screen.title}
            </button>
          ))}
        </div>
      ) : (
        <figcaption>{screens[0].title}</figcaption>
      )}
    </figure>
  );
}

// Adapted from ruixen.ui Phone Scroll Hero (21st.dev, demo 27355):
// scroll-linked tilt, scale and title/phone overlap; Samsung-style flat frame.
function PhoneScrollHero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const rotateX = useTransform(scrollYProgress, [0, 0.65, 1], [32, 0, -4]);
  const scale = useTransform(scrollYProgress, [0, 0.65, 1], [0.88, 1.07, 1.07]);
  const y = useTransform(scrollYProgress, [0, 0.65, 1], [60, -45, -65]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -24]);
  const trail = useTransform(scrollYProgress, [0, 0.8], [0.15, 1]);
  const nearY = useTransform(scrollYProgress, [0, 0.65, 1], [35, -80, -100]);
  const farY = useTransform(scrollYProgress, [0, 0.65, 1], [0, -30, -45]);
  const cyclistX = useTransform(scrollYProgress, [0, 1], [0, 240]);
  return (
    <section className="jt-phone-hero" id="top" ref={ref}>
      <motion.div className="jt-phone-title" style={{ y: reduced ? 0 : titleY }}>
        <p className="jt-eyebrow">대전의 일상에, 잘타슈</p>
        <h1>
          도착할 때의
          <br />
          <em>자전거 수를</em>
          <br />
          미리 확인하세요.
        </h1>
        <p className="jt-intro">
          자전거가 남아 있을 대여소부터 오르막이 적은 길까지.
          <br />
          출발하기 전, 잘타슈로 한 번 더 확인해요.
        </p>
        <div className="jt-actions">
          <a className="jt-button" href={appHref}>
            웹에서 이용하기 <Arrow />
          </a>
          <a className="jt-text-link" href="#install">
            설치 안내 ↓
          </a>
        </div>
      </motion.div>
      <div className="jt-phone-stage">
        <div className="jt-city-layer" aria-hidden="true">
          <svg viewBox="0 0 680 680" fill="none">
            <path d="M0 470Q120 370 270 460T680 420V650H0Z" fill="#e2edd7" fillOpacity=".5" />
            <path
              d="M0 560Q190 460 330 535T680 490"
              stroke="#c9dab6"
              strokeWidth="32"
              strokeOpacity=".3"
            />
            <g stroke="#9bad89" strokeWidth="2" opacity=".4">
              <path d="M70 445V295H148V458M86 320h14m16 0h14m-44 30h14m16 0h14m-44 30h14m16 0h14M530 448V260h80v165m-63-137h12m20 0h12m-44 28h12m20 0h12m-44 28h12m20 0h12" />
              <path d="M195 465V350m-25 28 25-38 25 38m-57 16 32-45 32 45M480 467V350m-23 30 23-34 23 34m-52 15 29-40 29 40" />
            </g>
            <path
              d="M45 610Q230 535 355 590T650 575"
              stroke="#4c8a12"
              strokeOpacity=".25"
              strokeWidth="2"
              strokeDasharray="4 8"
            />
          </svg>
          <motion.div className="jt-scene-cycle" style={{ x: reduced ? 100 : cyclistX }}>
            <Bike large />
          </motion.div>
        </div>
        <motion.a
          className="jt-float-feature jt-float-station"
          href="#features"
          style={{ y: reduced ? 0 : nearY, rotate: -6 }}
        >
          <span className="jt-float-icon">
            <Bike />
          </span>
          <span>
            <small>대여소에 도착하면?</small>
            <strong>AI 자전거 예측</strong>
          </span>
          <Arrow />
        </motion.a>
        <motion.a
          className="jt-float-feature jt-float-voice"
          href="#navigation"
          style={{ y: reduced ? 0 : farY, rotate: 5 }}
        >
          <span className="jt-float-icon">↱</span>
          <span>
            <small>시선은 앞에</small>
            <strong>길 안내는 음성으로</strong>
          </span>
        </motion.a>
        <svg className="jt-hero-trail" viewBox="0 0 700 720" fill="none" aria-hidden="true">
          <path
            d="M20 570C-10 400 215 535 115 300S385 65 525 175 650 505 520 595 275 650 360 710"
            stroke="currentColor"
            strokeOpacity=".1"
            strokeWidth="2"
          />
          <motion.path
            d="M20 570C-10 400 215 535 115 300S385 65 525 175 650 505 520 595 275 650 360 710"
            stroke="currentColor"
            strokeOpacity=".35"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ pathLength: reduced ? 1 : trail }}
          />
          <circle cx="525" cy="175" r="8" fill="white" stroke="currentColor" strokeOpacity=".4" />
          <circle cx="20" cy="570" r="5" fill="currentColor" fillOpacity=".35" />
        </svg>
        <div className="jt-phone-caption left" aria-hidden="true">
          <span>01 / 도착 시점의 자전거</span>
          <strong>
            지금 몇 대보다
            <br />
            내가 갈 때 몇 대인지.
          </strong>
        </div>
        <motion.div
          className="jt-galaxy-frame"
          style={{ rotateX: reduced ? 0 : rotateX, scale: reduced ? 1 : scale, y: reduced ? 0 : y }}
        >
          <div className="jt-galaxy-screen" data-media-slot="hero">
            {media.hero ? (
              <img src={media.hero} alt="잘타슈 지도와 대여소 화면" />
            ) : (
              <>
                <Bike large />
                <strong>잘타슈</strong>
                <span>실제 앱 화면이 들어갈 자리</span>
                <small>지도 · 대여소 · 자전거 예측</small>
              </>
            )}
          </div>
          <i className="jt-camera" aria-hidden="true" />
        </motion.div>
        <div className="jt-phone-caption right" aria-hidden="true">
          <span>02 / 나에게 맞는 경로</span>
          <strong>
            같은 목적지도
            <br />
            조금 더 편한 길로.
          </strong>
        </div>
      </div>
      <p className="jt-scroll-hint">대여소를 찾고 · 내게 맞는 길로 · 안내를 들으며 ↓</p>
    </section>
  );
}
function ScrollForecast() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [time, setTime] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) =>
    setTime(Math.min(3, Math.floor(Math.max(0, v) * 4))),
  );
  return (
    <section className={`jt-forecast-scroll ${reduced ? 'is-static' : ''}`} id="features" ref={ref}>
      <div className="jt-forecast jt-section">
        <Reveal className="jt-feature-heading">
          <p className="jt-eyebrow">01 — 출발하기 전에</p>
          <h2>
            지금 말고,
            <br />
            <em>도착할 때</em>는?
          </h2>
          <p>
            대여소까지 걸어갔는데 자전거가 없다면.
            <br />
            5분, 10분, 15분 뒤 예상 수량을 보고
            <br />
            어디로 갈지 한 번 더 판단해요.
          </p>
        </Reveal>
        <MediaSlot name="forecast" label="AI 예측 앱 화면" />
        <Reveal className="jt-forecast-play">
          <div className="jt-demo-top">
            <span>스크롤을 내리면 시간이 흐릅니다</span>
            <small>기능 설명용 예시</small>
          </div>
          <ol className="jt-time-track" aria-label="시간별 자전거 수 예시">
            {times.map((label, index) => (
              <li key={label} aria-current={time === index ? 'step' : undefined}>
                <span>{label}</span>
                {reduced && <strong>{examples[index]}대</strong>}
              </li>
            ))}
          </ol>
          <div className="jt-time-progress" aria-hidden="true">
            <motion.span style={{ scaleX: reduced ? 1 : scrollYProgress }} />
          </div>{' '}
          <div className="jt-count-scene">
            <span className="jt-station-label">예시 대여소 A</span>
            <div className="jt-count" aria-live="polite">
              <motion.strong
                key={time}
                initial={reduced ? false : { y: 15, opacity: 0.4 }}
                animate={{ y: 0, opacity: 1 }}
              >
                {examples[time]}
              </motion.strong>
              <span>대</span>
            </div>
            <span className="jt-count-description">
              {time === 0 ? '현재 이용 가능한 자전거' : '도착 시점의 예상 자전거'}
            </span>
            <div className="jt-bike-rack" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <motion.div
                  key={i}
                  className={i < examples[time] ? 'available' : ''}
                  animate={{
                    x: !reduced && i >= examples[time] ? 14 : 0,
                    y: !reduced && i >= examples[time] ? -12 : 0,
                    opacity: i < examples[time] ? 1 : 0.12,
                    rotate: !reduced && i >= examples[time] ? -12 : 0,
                  }}
                  transition={{ delay: reduced ? 0 : i * 0.04, duration: 0.4 }}
                >
                  <Bike />
                </motion.div>
              ))}
            </div>
          </div>
          <svg className="jt-forecast-line" viewBox="0 0 400 58" aria-hidden="true">
            <path d="M20 9C80 9 95 22 140 23S215 26 260 32 340 48 380 49" />
            <motion.circle
              initial={false}
              cx={20}
              cy={9}
              r="8"
              animate={{ cx: [20, 140, 260, 380][time], cy: [9, 23, 32, 49][time] }}
              transition={{ duration: reduced ? 0 : 0.5 }}
            />
          </svg>
          <p className="jt-demo-foot">
            예측은 선택을 돕는 참고 정보이며, 실제 수량과 다를 수 있어요.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const chapters = [
  { id: 'top', label: '서비스 소개' },
  { id: 'features', label: '자전거 수 예측' },
  { id: 'routes', label: '경로 비교' },
  { id: 'map', label: '장소·대여소' },
  { id: 'bike-status', label: '자전거 상태' },
  { id: 'navigation', label: '음성 길 안내' },
  { id: 'install', label: '이용·설치' },
];
const chapterRowHeight = 44;
const chapterTrailInset = chapterRowHeight / 2;
const chapterTrailLength = chapterRowHeight * (chapters.length - 1);
const chapterRailHeight = chapterTrailLength + chapterTrailInset * 2;
const trailPoint = (t: number) => ({
  x: 26 + 12 * Math.cos(t * Math.PI * 5),
  y: chapterTrailInset + t * chapterTrailLength,
});
const journeyPath = Array.from({ length: 101 }, (_, i) => {
  const p = trailPoint(i / 100);
  return (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y;
}).join(' ');
function JourneyProgress({ percent }: { percent: number }) {
  const reduced = useReducedMotion();
  const point = trailPoint(percent / 100);
  return (
    <div
      className="jt-journey-progress"
      style={{ height: chapterRailHeight }}
      role="progressbar"
      aria-label="자전거 여정 진행률"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <svg
        viewBox={`0 0 140 ${chapterRailHeight}`}
        style={{ height: chapterRailHeight }}
        aria-hidden="true"
      >
        <path d={journeyPath} fill="none" stroke="#dce6d2" strokeWidth="8" strokeLinecap="round" />
        <path d={journeyPath} fill="none" stroke="#a9bd95" strokeWidth="1" strokeDasharray="2 5" />
        <motion.path
          d={journeyPath}
          fill="none"
          stroke="#4c8a12"
          strokeOpacity=".45"
          strokeWidth="3"
          style={{ pathLength: percent / 100 }}
        />

        <motion.g
          animate={{ x: point.x, y: point.y }}
          transition={{ duration: reduced ? 0 : 0.18, ease: 'linear' }}
        >
          <circle r="16" fill="#fff" stroke="#d5e2c8" />
          <g
            transform="translate(-13 -11) scale(.17)"
            stroke="#4c8a12"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="37" cy="76" r="27" />
            <circle cx="127" cy="76" r="27" />
            <path d="m37 76 26-48 29 48H37l34-32h43m-22 32 22-32 13 32m-13-32-8-23h15M54 28h22" />
            <motion.g
              style={{ rotate: reduced ? 0 : percent * 14.4, transformOrigin: '92px 76px' }}
            >
              <path d="M78 76h28M92 62v28" />
            </motion.g>
          </g>
        </motion.g>
      </svg>
    </div>
  );
}
function BikeStatusFeature() {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ['start end', 'end start'],
  });
  const qrY = useTransform(scrollYProgress, [0, 0.48, 1], [72, 0, -36]);
  const qrRotate = useTransform(scrollYProgress, [0, 0.48, 1], [-7, -3, 1]);
  const phoneY = useTransform(scrollYProgress, [0, 0.48, 1], [112, 0, -72]);
  const phoneRotate = useTransform(scrollYProgress, [0, 0.48, 1], [3.5, 1.5, -1]);
  const reportY = useTransform(scrollYProgress, [0, 0.48, 1], [132, 0, -44]);
  return (
    <section ref={section} className="jt-bike-status jt-section" id="bike-status">
      <Reveal className="jt-bike-status-copy">
        <p className="jt-eyebrow">04 — 대여하기 전에</p>
        <h2>
          QR을 찍고,
          <br />
          <em>자전거 상태부터.</em>
        </h2>
        <p>
          타기 전에 QR을 찍으면 점검이 필요한지,
          <br />
          최근 어떤 부위에 제보가 있었는지 확인할 수 있어요.
        </p>
        <ul className="jt-bike-status-points">
          <li>
            <span>01</span>
            <strong>QR 스캔</strong>
            <small>자전거 번호를 바로 확인</small>
          </li>
          <li>
            <span>02</span>
            <strong>하자 부위</strong>
            <small>브레이크·타이어·안장 표시</small>
          </li>
          <li>
            <span>03</span>
            <strong>최근 제보</strong>
            <small>이용자 제보 내용과 시각 확인</small>
          </li>
        </ul>
      </Reveal>
      <Reveal className="jt-bike-status-scene">
        <div className="jt-bike-status-aside">
          <motion.div
            className="jt-qr-visual"
            style={{ y: reduced ? 0 : qrY, rotate: reduced ? -3 : qrRotate }}
            aria-hidden="true"
          >
            <svg className="jt-qr-symbol" viewBox="0 0 120 120">
              <g fill="currentColor">
                <path d="M13 39V13h26v8H21v18H13Zm68-26h26v26h-8V21H81v-8ZM13 81h8v18h18v8H13V81Zm86 0h8v26H81v-8h18V81Z" />
                <path
                  fillRule="evenodd"
                  d="M29 29h28v28H29V29Zm9 9v10h10V38H38Zm25-9h28v28H63V29Zm9 9v10h10V38H72ZM29 63h28v28H29V63Zm9 9v10h10V72H38Z"
                />
                <path d="M64 64h11v11H64V64Zm14 0h13v27H78V78h-8V64h8Zm-14 14h11v13H64V78Z" />
              </g>
            </svg>
            <motion.span
              className="jt-scan-line"
              animate={reduced ? undefined : { y: [0, 91, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <small>
              <i /> 자전거 QR 스캔
            </small>
          </motion.div>
          <motion.div
            className="jt-condition-card"
            style={{ y: reduced ? 0 : reportY }}
            initial={false}
            whileInView={reduced ? undefined : { opacity: [0, 1] }}
            viewport={{ once: false, amount: 0.6 }}
            transition={{ duration: 0.45 }}
          >
            <div className="jt-condition-heading">
              <span>점검 필요</span>
              <b>3</b>
            </div>
            <strong>최근 제보</strong>
            <div className="jt-condition-tags">
              <span>브레이크</span>
              <span>타이어</span>
              <span>안장</span>
            </div>
          </motion.div>
        </div>
        <motion.div
          className="jt-bike-status-phone-motion"
          style={{ y: reduced ? 0 : phoneY, rotate: reduced ? 0 : phoneRotate }}
        >
          <MediaSlot name="bikeStatus" label="QR 자전거 상태 확인 앱 화면" />
        </motion.div>
      </Reveal>
    </section>
  );
}
function VoiceFeature() {
  const reduced = useReducedMotion();
  return (
    <section className="jt-voice jt-section" id="navigation">
      <Reveal className="jt-feature-heading">
        <p className="jt-eyebrow">05 — 달리는 동안에도</p>
        <h2>
          시선은 앞에,
          <br />
          <em>길 안내는 음성으로.</em>
        </h2>
        <p>
          휴대폰 거치대가 없으면 길을 확인할 때마다 불편하니까.
          <br />
          화면을 계속 들여다보는 대신,
          <br />
          회전할 곳을 음성으로 안내받아요.
        </p>
        <p className="jt-voice-limit">
          기기·브라우저에 따라 음성 지원이 달라요. 화면 잠금·백그라운드 상태의 안내는 보장되지
          않아요. 출발 전에 확인하고, 조작이 필요하면 안전한 곳에 멈춰 주세요.
        </p>
      </Reveal>
      <Reveal className="jt-voice-scene">
        <MediaSlot name="navigation" label="음성 경로 안내 앱 화면" />
        <div className="jt-voice-illustration">
          <div className="jt-voice-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="jt-voice-bubble">
            <span className="jt-voice-tag">음성 안내 예시 · 실제 소리는 재생하지 않아요</span>
            <strong>
              “200m 앞<br />
              우회전하세요.”
            </strong>
            <div className="jt-waveform" aria-hidden="true">
              {[14, 26, 40, 22, 50, 32, 44, 20, 38, 52, 26, 16, 36, 24, 12].map((height, i) => (
                <motion.span
                  key={i}
                  style={{ height }}
                  initial={false}
                  whileInView={reduced ? { scaleY: 1 } : { scaleY: [0.4, 1, 0.5, 0.85, 0.4, 1] }}
                  viewport={{ once: true, amount: 1 }}
                  transition={{ duration: 2.8, delay: i * 0.04, ease: 'easeInOut' }}
                />
              ))}
            </div>
          </div>
        </div>
        <ul className="jt-voice-points">
          <li>
            <span>01</span>회전할 곳을 미리 안내
          </li>
          <li>
            <span>02</span>가까워지면 한 번 더 안내
          </li>
          <li>
            <span>03</span>필요할 때 음성 켜기·끄기
          </li>
        </ul>
      </Reveal>
    </section>
  );
}

const installSteps = {
  android: [
    { title: 'Chrome에서 열기', detail: '잘타슈 웹 주소를 Chrome에서 열어요.' },
    { title: '브라우저 메뉴 열기', detail: '오른쪽 위의 ⋮ 버튼을 눌러 메뉴를 열어요.' },
    { title: '홈 화면에 추가', detail: '홈 화면에 추가 또는 앱 설치를 선택하고 확인해요.' },
  ],
  iphone: [
    { title: 'Safari에서 열기', detail: '잘타슈 웹 주소를 Safari에서 열어요.' },
    { title: '공유 메뉴 열기', detail: '화면 아래의 공유 버튼을 눌러 메뉴를 열어요.' },
    { title: '홈 화면에 추가', detail: '홈 화면에 추가를 선택하고 이름을 확인해요.' },
  ],
};
function InstallSteps({ platform }: { platform: keyof typeof installSteps }) {
  const [expanded, setExpanded] = useState(false);
  const steps = installSteps[platform];
  return (
    <div className="jt-compact-install">
      <button
        className="jt-install-toggle"
        aria-expanded={expanded}
        aria-controls="install-instructions"
        onClick={() => setExpanded(!expanded)}
      >
        홈 화면 추가 방법 {expanded ? '접기 −' : '보기 +'}
      </button>
      <div
        id="install-instructions"
        className={'jt-install-instructions' + (expanded ? ' is-expanded' : '')}
      >
        <ol
          className="jt-install-step-list"
          aria-label={(platform === 'android' ? 'Android' : 'iPhone') + ' 홈 화면 추가 단계'}
        >
          {steps.map((item, index) => (
            <li key={item.title}>
              <span aria-hidden="true">0{index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="jt-install-note">기기·브라우저에 따라 메뉴 이름과 위치가 다를 수 있어요.</p>
      </div>
    </div>
  );
}

function ChapterNavigation() {
  const [position, setPosition] = useState({ active: 0, percent: 0 });
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const marker = window.scrollY + window.innerHeight * 0.42;
      const tops = chapters.map(({ id }) => {
        const section = document.getElementById(id);
        return section ? section.getBoundingClientRect().top + window.scrollY : Infinity;
      });
      let active = 0;
      tops.forEach((top, index) => {
        if (top <= marker) active = index;
      });
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4)
        active = chapters.length - 1;
      const currentTop = tops[active] ?? marker;
      const nextTop = tops[active + 1];
      const fraction =
        nextTop === undefined || !Number.isFinite(nextTop)
          ? 0
          : Math.min(
              1,
              Math.max(0, (marker - currentTop) / Math.max(1, nextTop - currentTop)),
            );
      const percent = Math.round(((active + fraction) / (chapters.length - 1)) * 100);
      setPosition((previous) =>
        previous.active === active && previous.percent === percent ? previous : { active, percent },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const moveToHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const index = chapters.findIndex((chapter) => chapter.id === id);
      const section = index >= 0 ? document.getElementById(id) : null;
      if (index >= 0) {
        setPosition({
          active: index,
          percent: Math.round((index / (chapters.length - 1)) * 100),
        });
      }
      section?.scrollIntoView({ block: 'start' });
      schedule();
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    chapters.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', moveToHash);
    update();
    const hashFrame = requestAnimationFrame(() => requestAnimationFrame(moveToHash));
    return () => {
      cancelAnimationFrame(hashFrame);
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', moveToHash);
    };
  }, []);
  return (
    <nav className="jt-chapters" aria-label="페이지 목차">
      <span className="jt-chapter-caption">지금 보고 있는 이야기</span>
      <div className="jt-chapter-road">
        <JourneyProgress percent={position.percent} />
        <ol>
          {chapters.map((chapter, index) => (
            <li
              key={chapter.id}
              style={{ marginLeft: trailPoint(index / (chapters.length - 1)).x - 5.5 }}
            >
              <a
                href={'#' + chapter.id}
                aria-current={position.active === index ? 'location' : undefined}
                aria-label={chapter.label}
                onClick={(event) => {
                  event.preventDefault();
                  setPosition({
                    active: index,
                    percent: Math.round((index / (chapters.length - 1)) * 100),
                  });
                  window.history.replaceState(null, '', '#' + chapter.id);
                  document
                    .getElementById(chapter.id)
                    ?.scrollIntoView({ behavior: 'auto', block: 'start' });
                }}
              >
                <span className="jt-chapter-dot" aria-hidden="true" />
                <span className="jt-chapter-label">{chapter.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

// Reveal scene blocks without moving sticky section containers.
function useChapterEntrance() {
  const reduced = useReducedMotion();
  useEffect(() => {
    const selectors = [
      '#features .jt-feature-heading', '#features .jt-screen-gallery', '#features .jt-forecast-play',
      '#routes .jt-route-header', '#routes .jt-route-scene',
      '#map .jt-map-copy', '#map .jt-map-demo',
      '#bike-status .jt-bike-status-copy', '#bike-status .jt-bike-status-scene',
      '#navigation .jt-feature-heading', '#navigation .jt-voice-scene',
      '#install .jt-finish', '#install > .jt-eyebrow', '#install > h2',
      '#install > .jt-actions', '#install .jt-install-guide',
    ];
    const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)));
    if (reduced) return;
    const animations = new Map<HTMLElement, Animation>();
    const reveal = (node: HTMLElement, immediate = false, fromAbove = false) => {
      animations.get(node)?.cancel();
      node.classList.remove('jt-entrance-pending');
      if (immediate) {
        animations.get(node)?.cancel();
        return;
      }
      const visual = node.matches('.jt-screen-gallery, .jt-forecast-play, .jt-route-scene, .jt-map-demo, .jt-voice-scene');
      const animation = node.animate(
        [{ opacity: 0, translate: fromAbove ? '0 -64px' : '0 72px' }, { opacity: 1, translate: '0 0' }],
        { duration: 950, delay: visual ? 120 : 0, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' },
      );
      animations.set(node, animation);
    };
    // Rearm only beyond the viewport, so small scroll reversals never flash.
    const armed = new Map<HTMLElement, 'above' | 'below'>();
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      frame = 0;
      const height = window.innerHeight;
      nodes.forEach((node) => {
        if (preference.matches || node.contains(document.activeElement)) {
          reveal(node, true);
          armed.delete(node);
          return;
        }
        const rect = node.getBoundingClientRect();
        // Ignore our own visual translation when determining visibility.
        const translate = getComputedStyle(node).translate.split(' ');
        const shift = translate.length > 1 ? parseFloat(translate[1]) || 0 : 0;
        const top = rect.top - shift;
        const bottom = rect.bottom - shift;
        if (bottom < -80 || top > height + 80) {
          animations.get(node)?.cancel();
          armed.set(node, bottom < -80 ? 'above' : 'below');
          node.classList.add('jt-entrance-pending');
        } else if (armed.has(node) && top < height * .88 && bottom > height * .12) {
          const fromAbove = armed.get(node) === 'above';
          armed.delete(node);
          reveal(node, false, fromAbove);
        }
      });
    };
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect();
      armed.set(node, rect.bottom < 0 ? 'above' : 'below');
      node.classList.add('jt-entrance-pending');
    });
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    nodes.forEach((node) => observer.observe(node));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    preference.addEventListener('change', schedule);
    update();
    const onFocus = (event: FocusEvent) => {
      nodes.forEach((node) => {
        if (event.target instanceof Node && node.contains(event.target)) {
          reveal(node, true);
          armed.delete(node);
        }
      });
    };
    document.addEventListener('focusin', onFocus);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      preference.removeEventListener('change', schedule);
      document.removeEventListener('focusin', onFocus);
      animations.forEach((animation) => animation.cancel());
      nodes.forEach((node) => node.classList.remove('jt-entrance-pending'));
    };
  }, [reduced]);
}

export function InstallLandingPage() {
  useChapterEntrance();
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: root, offset: ['start start', 'end end'] });
  const glowX = useTransform(
    scrollYProgress,
    [0, 0.35, 0.7, 1],
    ['0vw', '-55vw', '-15vw', '-45vw'],
  );
  const glowY = useTransform(scrollYProgress, [0, 0.5, 1], ['0vh', '25vh', '-10vh']);

  const [gentle, setGentle] = useState(false);
  const [mapStep, setMapStep] = useState(0);
  const [platform, setPlatform] = useState<'iphone' | 'android'>('android');
  return (
    <main className="jt" ref={root}>
      <ChapterNavigation />
      <div className="jt-atmosphere" aria-hidden="true">
        <motion.div
          className="jt-soft-glow"
          style={{ x: reduced ? 0 : glowX, y: reduced ? 0 : glowY }}
        />
      </div>
      <header className="jt-nav">
        <a className="jt-brand" href="#top">
          <Bike />
          <b>잘타슈</b>
        </a>
        <nav aria-label="소개 페이지 메뉴">
          <a href="#features">잘타슈의 여정</a>
          <a href="#install">이용·설치 안내</a>
          <a className="jt-nav-start" href={appHref}>
            웹에서 시작하기 <Arrow />
          </a>
        </nav>
      </header>
      <PhoneScrollHero />
      <ScrollForecast />
      <section className="jt-routes" id="routes">
        <div className="jt-route-header">
          <div>
            <p className="jt-eyebrow">02 — 내게 맞는 길로</p>
            <h2>
              오늘은 어떤 길로
              <br />
              <em>달려볼까요?</em>
            </h2>
          </div>
          <div>
            <p>
              익숙한 길도, 오르막이 적은 길도.
              <br />두 경로를 비교하고 오늘의 길을 골라요.
            </p>
            <div className="jt-route-options" role="group" aria-label="경로 선택">
              <button aria-pressed={!gentle} onClick={() => setGentle(false)}>
                일반 경로 ↗
              </button>
              <button aria-pressed={gentle} onClick={() => setGentle(true)}>
                오르막이 적은 경로 〰
              </button>
            </div>
          </div>
        </div>
        <div className="jt-route-scene">
          <div className={'jt-route-canvas ' + (gentle ? 'gentle' : 'direct')}>
            <svg
              viewBox="0 0 1100 360"
              role="img"
              aria-label={gentle ? '오르막을 돌아가는 경로 예시' : '언덕을 지나는 일반 경로 예시'}
            >
              <path
                d="M0 305C100 260 180 325 265 235S390 90 485 160 610 180 685 105 820 95 925 190 1040 180 1100 210V360H0Z"
                fill="#e6eadf"
              />
              <path
                d="M280 210 355 98 428 204M583 179 691 34 809 179"
                fill="none"
                stroke="#d1d8c5"
                strokeWidth="2"
              />
              <motion.path
                initial={reduced ? false : { pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: reduced ? 0 : 1.4 }}
                className="jt-direct-path"
                d="M70 280C240 280 270 65 460 160S620 75 790 165 960 200 1030 140"
              />
              <motion.path
                initial={reduced ? false : { pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: reduced ? 0 : 1.4, delay: reduced ? 0 : 0.15 }}
                className="jt-gentle-path"
                d="M70 280C250 340 350 295 520 305S750 260 810 265 950 320 1030 140"
              />
              <g fill="#4c8a12" stroke="white" strokeWidth="5">
                <circle cx="70" cy="280" r="12" />
                <circle cx="1030" cy="140" r="12" />
              </g>
              <text x="47" y="245">
                출발
              </text>
              <text x="1008" y="105">
                도착
              </text>
              <RouteBike key={String(gentle)} gentle={gentle} />
            </svg>
            <div className="jt-route-status" aria-live="polite">
              <span className="jt-dot" />
              {gentle ? '조금 돌아가도, 오르막은 가볍게.' : '일반 경로를 따라 달려요.'}
            </div>
          </div>
          <MediaSlot name="route" label="실제 경로 비교 화면" />
        </div>
        <p className="jt-route-disclaimer">경로 형태는 기능 설명을 위한 예시입니다.</p>
      </section>
      <section className="jt-map-feature jt-section" id="map">
        <Reveal className="jt-map-demo">
          <div className="jt-map-illustration">
            <div className="jt-search">
              <span aria-hidden="true">⌕</span>
              {['어디로 가볼까요?', '출발지와 도착지를 골라요', '주변 대여소를 확인해요'][mapStep]}
              <span aria-hidden="true">↗</span>
            </div>
            <div className={'jt-mini-map step-' + mapStep}>
              <div className="jt-river" />
              <div className="jt-road road-a" />
              <div className="jt-road road-b" />
              <div className="jt-road road-c" />
              <span className="jt-park park-a" />
              <span className="jt-park park-b" />
              <button
                className="jt-map-pin pin-a"
                onClick={() => setMapStep(2)}
                aria-label="예시 대여소 선택"
              >
                <Bike />
              </button>
              <span className="jt-map-pin pin-b">도착</span>
              <span className="jt-mini-route" />
              <span className="sr-only" role="status">
                {['가고 싶은 곳을 검색', '출발지와 도착지 선택', '가까운 대여소 발견'][mapStep]}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mapStep}
                  className="jt-place-card"
                  initial={reduced ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <small>기능 설명용 예시</small>
                  <strong>
                    {['가고 싶은 곳을 검색', '출발 → 도착', '가까운 대여소 발견'][mapStep]}
                  </strong>
                  <span>
                    {
                      [
                        '장소부터 찾아보세요.',
                        '여정의 시작과 끝을 선택해요.',
                        '현재 수량과 위치를 함께 확인해요.',
                      ][mapStep]
                    }
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <MediaSlot name="map" label="지도 탐색 앱 화면" />
        </Reveal>
        <Reveal className="jt-map-copy">
          <p className="jt-eyebrow">03 — 검색부터 출발까지</p>
          <h2>
            이동의 시작은,
            <br />
            <em>지도 한 곳에서.</em>
          </h2>
          <p>
            장소를 찾고, 출발지와 도착지를 고르고,
            <br />
            주변 대여소까지 자연스럽게 이어져요.
          </p>
          <div className="jt-map-steps" role="group" aria-label="지도 기능 살펴보기">
            {['장소 검색', '출발지·도착지 선택', '주변 대여소 확인'].map((s, i) => (
              <button key={s} onClick={() => setMapStep(i)} aria-pressed={i === mapStep}>
                <span>0{i + 1}</span>
                {s}
                <Arrow />
              </button>
            ))}
          </div>
        </Reveal>
      </section>
      <BikeStatusFeature />
      <VoiceFeature />
      <section className="jt-install" id="install">
        <div className="jt-finish">
          <span className="jt-finish-line" />
          <Bike large />
          <span className="jt-arrived">도착! 이제 직접 달려볼까요?</span>
        </div>
        <p className="jt-eyebrow">잘타슈와 함께하는 자전거 여정</p>
        <h2>
          이제 잘타슈와 함께
          <br />
          <em>출발해 보세요.</em>
        </h2>
        <div className="jt-actions">
          <a className="jt-button" href={appHref}>
            웹에서 바로 시작하기 <Arrow />
          </a>
          <button className="jt-apk" disabled>
            Android APK · 준비 중
          </button>
        </div>
        <div className="jt-install-guide">
          <div>
            <h3>
              홈 화면에 두고,
              <br />
              앱처럼 가볍게.
            </h3>
            <p>설치 파일 없이도 빠르게 열 수 있어요.</p>
          </div>
          <div>
            <div className="jt-platform" role="group" aria-label="홈 화면 추가 안내 기기">
              <button aria-pressed={platform === 'iphone'} onClick={() => setPlatform('iphone')}>
                iPhone · Safari
              </button>
              <button aria-pressed={platform === 'android'} onClick={() => setPlatform('android')}>
                Android · Chrome
              </button>
            </div>
            <InstallSteps key={platform} platform={platform} />
          </div>
        </div>
      </section>
      <footer className="jt-footer">
        <a href="#top" className="jt-brand">
          <Bike />
          <b>잘타슈</b>
        </a>
        <span>대전 시민의 더 가벼운 자전거 여정.</span>
        <a href="#top">맨 위로 ↑</a>
      </footer>
    </main>
  );
}
