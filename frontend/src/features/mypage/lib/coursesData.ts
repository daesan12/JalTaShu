/** 추천코스 콘텐츠 — 타슈 공식 앱 안내 기준 (정적 콘텐츠라 코드에 보관) */

export interface Course {
  /** public/recommended-routes 아래의 미리 계산된 경로 파일 식별자 */
  id: string;
  name: string;
  route: string;
  distance: string;
  duration: string;
  /** 추천 코스의 양 끝을 기존 장소 검색 API로 찾을 때 쓰는 이름 */
  startQuery: string;
  endQuery: string;
}

/** 코스정보 탭 — 5개 코스 */
export const COURSES: Course[] = [
  {
    id: 'hanbat-geumdong',
    name: '한밭수목원 ~ 동물원 ~ 금동고개길',
    route: '한밭수목원 → 평송수련원 → 유등천 하상도로 → 유등교 → 복수교 → 동물원 → 금동고개',
    distance: '17km',
    duration: '왕복 3~4시간 소요',
    startQuery: '한밭수목원',
    endQuery: '금동고개',
  },
  {
    id: 'hanbat-donghaksa',
    name: '한밭수목원 ~ 월드컵경기장 ~ 동학사',
    route:
      '한밭수목원 → 대전문화예술의 전당 → 하나로아파트 앞 도로 → 갑천대교 → 충남대 → 월드컵 경기장 → 현충원 → 박정자삼거리 → 동학사 주차장',
    distance: '17km',
    duration: '왕복 3~4시간 소요',
    startQuery: '한밭수목원',
    endQuery: '동학사 주차장',
  },
  {
    id: 'hanbat-daecheong',
    name: '한밭수목원 ~ 대청댐 가는 길',
    route:
      '한밭수목원 → 엑스포다리 건너 하상도로 진입 → 갑천 하상도로(전민동 방면) → 원천교 하상도로 → 대전 정수장 → 전민동 엑스포 아파트 → 구즉 신구교다리 건너 → 한국타이어 → 신탄진 → 대청댐',
    distance: '18km',
    duration: '왕복 3~4시간 소요',
    startQuery: '한밭수목원',
    endQuery: '대청댐',
  },
  {
    id: 'hanbat-ppuri',
    name: '한밭수목원 ~ 침산동 뿌리공원',
    route:
      '한밭수목원 → 평송수련원 → 유등천 하상도로 → 유등교 → 복수교 → 안영동 농협마트 → 안영교 → 뿌리공원',
    distance: '11km',
    duration: '왕복 2시간 소요',
    startQuery: '한밭수목원',
    endQuery: '뿌리공원',
  },
  {
    id: 'hanbat-research-complex',
    name: '과학기술대 ~ 연구단지길',
    route: '한밭수목원 → 대덕대교 건너 좌회전 → 기상청 → 카이스트 우회전 → 연구단지 체육공원',
    distance: '4km',
    duration: '왕복 1시간 소요',
    startQuery: '한밭수목원',
    endQuery: '연구단지 체육공원',
  },
];

export interface BikeRoad extends Course {
  /** 연인길·건강길·관광길 */
  badge: string;
  title: string;
  description: string;
  directions: string;
  tip: string;
}

/** 자전거 길 3선 탭 */
export const BIKE_ROADS: BikeRoad[] = [
  {
    id: 'daecheong-eco',
    name: '대청호 자연 생태 자전거길_연인길',
    badge: '연인길',
    title: '대청호 자연 생태 자전거길',
    description:
      '대청호반은 가을정취가 물씬 드러나는 풍성한 억새밭을 비롯한 대청호반의 비경도 마음껏 감상할 수 있고, 주변에 자연생태공원과 자연생태관, 추동습지보호구역 등 볼거리도 많으며, 인근에 ‘슬픈연가’ 촬영지, 농촌체험 찬샘마을, 연꽃마을, 신선바위 등 풍부한 생태·관광자원을 보유하고 있다. 또한 사계절 아름다운 풍경을 자랑하며, 전국적인 명소로 관심과 인기를 받고 있고 대청호반은 연인·가족과 함께 자전거 라이딩을 즐기며 추억을 만들기에 좋은 코스이다.',
    route: '대청호반 자연생태공원 → 대청호 자연생태관 → 국화꽃단지 → 전망좋은 곳',
    distance: '5.8km (왕복)',
    duration: '1시간 30분 (시속 15km 기준)',
    startQuery: '대청호반 자연생태공원',
    endQuery: '대청호 전망좋은 곳',
    directions: '대전역 동광장 버스정류소에서 대청호반 자연생태공원까지 약 15km',
    tip: '대청호반의 가을정취가 물씬 드러나는 풍성한 억새밭은 대청호반의 비경도 마음껏 감상할 수 있는 장소이다.',
  },
  {
    id: 'bomunsan-health',
    name: '보문산의 자전거 길_건강길',
    badge: '건강길',
    title: '보문산의 자전거길',
    description:
      '자연속 깨끗한 공기를 마시며 힐링·건강코스로 탁월 접근성이 우수하고, 시·종점이 공원으로 자전거 나들이로 적합하다.',
    route: '보문산입구 → 청년의 광장 → 사정공원 → 대전오월드 → 뿌리공원',
    distance: '10km',
    duration: '왕복 2시간',
    startQuery: '보문산입구',
    endQuery: '뿌리공원',
    directions: '대전역에서 보문산 입구까지 약 2.5km\n시내버스 노선 : 802번',
    tip: '매년 뿌리축제 시 효월드 관광 시 볼거리와 즐길거리 풍부\n오월드 내에 주랜드, 조이랜드, 플라워랜드 등 다채로운 볼거리로 온 가족이 즐길 수 있는 테마공원',
  },
  {
    id: 'shintanjin-lohas',
    name: '로하스(신타길) 자전거길_관광길',
    badge: '관광길',
    title: '로하스(신타길) 자전거길',
    description:
      '국토종주 금강 자전거길 시·종점 및 투르 드 코리아 2016 개최구간으로써 신탄진역, 신탄진 IC 등 대중교통의 접근성이 편리하고 도심 인근으로 가족 단위 나들이와 자전거 산책은 물론 로하스 가족공원에서 자연과 낭만을 즐기는 캠핑, 레포츠센터에서 수상스포츠까지 다채로운 여가활동을 즐길 수 있다.',
    route: '신탄진역 → 현도교 → 대청대교 → 레포츠센터 → 미호교 → 대청공원',
    distance: '7km',
    duration: '왕복 1시간 (시속 15km 기준)',
    startQuery: '신탄진역',
    endQuery: '대청공원',
    directions:
      '신탄진역 하차 후 현도교 방향\n신탄진 IC 통과 후 신탄진 방면 좌회전(신탄진역까지 약 1.3km)',
    tip: '아름다운 금강변의 자연경관을 즐기며 자전거 라이딩 후 인근 로하스 가족공원 캠핑장에서 오토캠핑, 글램핑, 카라반 등을 즐길 수 있다.',
  },
];
