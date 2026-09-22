잘타슈 — DEM을 이용한 OSRM 오르막 회피 프로필

`daejeon-dem.tif`의 실제 데이터를 변환한 결과와 OSRM 프로필 API 4용 구현입니다.
OSRM v5.27.1의 프로필·래스터·Lua 바인딩 소스를 기준으로 작성했습니다.
현재 사용 중인 OSRM 실행 파일의 버전은 제공되지 않았습니다. 실행 파일과 같은
버전의 `bicycle.lua` 및 `lib/`를 사용하고 실제 도로망에서 통합 검증해야 합니다.

현재 구현이 최소화하는 비용은 아래와 같습니다.

```text
구간 비용 = distance_weight × 구간 거리(m)
          + ascent_weight × 구간 내 누적 상승량(m)
          + 선택적인 급경사 비용

기본값: 구간 거리 + 30 × 누적 상승량
전체 경로 비용: 구간 비용의 합 (회전 가중치 = 0)
```

이 구현은 거리와 상승량의 절충입니다. **거리와 무관하게 누적 상승량만 가장 작은
경로를 보장하는 구현은 아닙니다.** 예를 들어 아주 긴 무오르막 우회로보다 짧은
약간의 오르막을 선택할 수 있습니다. 30은 조정 가능한 초기 실험값이며 검증된
생리학적 에너지 계수가 아닙니다. `ascent_weight`가 커질수록 오르막을 더 회피합니다.
거리 상한(예: 최단거리의 1.3배 이내)도 보장하지 않습니다.

정확히 "누적 상승량 최소, 동률일 때 거리 최소"가 필요하면 이는 다른 목적함수입니다.
작은 거리 계수를 더하는 것만으로 사전식 최적성을 보장할 수 없으며, OSRM의
가중치 정수화·최소 구간 가중치도 고려해야 합니다. 그래서 이 구현은 거리 계수 0을
명시적으로 거부합니다. 엄밀한 사전식 탐색이나 거리 제약 탐색은 별도 엔진 설계 대상입니다.

**확인한 입력 데이터**

| 항목 | 값 |
| --- | --- |
| 파일 | daejeon-dem.tif |
| 좌표계 | EPSG:4326 / WGS84 |
| 크기 | 1,179열 × 1,177행 |
| 격자 간격 | 1초각 = 약 0.000277778도 |
| 중앙 위도에서 지상 격자 간격 | 동서 약 24.94m, 남북 약 30.82m |
| 원본 경도 범위(외곽) | 127.2523611112 ~ 127.5798611112 |
| 원본 위도 범위(외곽) | 36.1820833333 ~ 36.5090277778 |
| 픽셀 값 범위 | -15 ~ 891 |
| NoData 표시값 / 실제 결측 픽셀 수 | -32768 / 0개 |
| 높이 단위 메타데이터 | 없음 |

입력 높이 단위를 미터로 가정해 변환했습니다. 원본 데이터 출처에서 높이 단위를
확인해야 합니다. 다른 단위라면 변환 시 `--vertical-scale`로 미터 환산 계수를 지정합니다.
EPSG:4326만으로 수직 단위나 수직 기준면까지 결정되는 것은 아닙니다.

**포함 파일**

| 파일 | 역할 |
| --- | --- |
| bicycle_uphill.lua | 기존 자전거 통행 규칙을 재사용하고 사용자 정의 비용을 적용 |
| dem_cost.lua | 도로 구간 내부 고도 샘플링, 누적 상승량 및 급경사 비용 계산 |
| config.lua | 거리·상승량 계수와 샘플링 간격 설정 |
| prepare_dem.py | GeoTIFF를 OSRM용 정수 격자로 변환 |
| dem/daejeon-dem.tif | 확인에 사용한 원본 DEM |
| dem/elevation.asc | 변환 완료된 헤더 없는 OSRM 래스터 |
| dem/metadata.lua | OSRM에 전달할 픽셀 중심 범위와 격자 크기 |
| dem/metadata.json | 원본 해시, 좌표계, 범위, 변환 정보 |
| test_profile.py | 변환 및 실제 Lua 콜백의 검증 코드 |

**1. 기존 OSRM과 같은 버전의 실행 파일·프로필을 준비합니다.**

이 패키지를 새 작업 디렉터리에 압축 해제합니다. 기존 최단시간 데이터와 구분되도록
새 `data/` 디렉터리에 대전 도로망 `daejeon.osm.pbf`를 복사합니다.
도로망 파일은 패키지에 포함되어 있지 않습니다.

DEM은 고도 격자이고 PBF는 도로 연결·통행 속성입니다. 두 자료가 함께 있어야
실제 경로를 계산할 수 있습니다. 대전 PBF의 통행 가능한 모든 구간과 중간 샘플이
`dem/metadata.json`의 픽셀 중심 범위 안에 있어야 합니다. 범위를 벗어나면
추출이 오류 좌표와 함께 중단됩니다. 경계 밖 높이를 0으로 간주하지 않습니다.
도시 경계보다 여유 있는 DEM과 그 안에 완전히 포함되는 도로망을 사용하는 것이 좋습니다.

바이너리를 직접 실행한다면 OSRM 프로필 디렉터리를 지정합니다.
해당 디렉터리에는 `bicycle.lua`와 같은 버전의 `lib/`가 있어야 합니다.

```bash
export OSRM_BASE_PROFILES=/absolute/path/to/osrm-backend/profiles
osrm-extract --version
```

**2. 이미 변환된 DEM을 이용해 MLD 데이터를 만듭니다.**

압축을 푼 `osrm-uphill` 디렉터리에서 실행합니다.

```bash
osrm-extract -p ./bicycle_uphill.lua ./data/daejeon.osm.pbf
osrm-partition ./data/daejeon.osrm
osrm-customize ./data/daejeon.osrm
osrm-routed --algorithm mld --port 5001 ./data/daejeon.osrm
```

기존 서버가 5000번 포트를 사용한다면 오르막 회피 서버는 5001번 포트로 실행할 수
있습니다. Spring에서 사용자가 고른 경로 옵션에 따라 해당 서버를 호출합니다.
`/route/v1/bike/...`의 `bike` 문자열만 변경해서 실행 중인 데이터셋의 가중치를
바꿀 수는 없습니다. 프로필은 전처리 때 적용됩니다.

Docker로 실행하는 경우에는 현재 배포와 동일한 **고정 버전**의 이미지 이름을
`OSRM_IMAGE`에 설정하고 아래 명령을 사용합니다. 이 명령은 기본 프로필이
이미지의 `/opt/bicycle.lua`, `/opt/lib/`에 있는 구성을 가정합니다.
다른 위치이면 `-e OSRM_BASE_PROFILES=...`를 모든 관련 명령에 추가합니다.

```bash
# OSRM_IMAGE는 기존 배포에 사용 중인 실제 이미지:고정태그로 먼저 설정하세요.
: "${OSRM_IMAGE:?Set OSRM_IMAGE to the exact image and tag used by your deployment}"

docker run --rm -v "$PWD:/data" "$OSRM_IMAGE" \
  osrm-extract -p /data/bicycle_uphill.lua /data/data/daejeon.osm.pbf
docker run --rm -v "$PWD:/data" "$OSRM_IMAGE" \
  osrm-partition /data/data/daejeon.osrm
docker run --rm -v "$PWD:/data" "$OSRM_IMAGE" \
  osrm-customize /data/data/daejeon.osrm
docker run --rm -p 5001:5000 -v "$PWD:/data" "$OSRM_IMAGE" \
  osrm-routed --algorithm mld /data/data/daejeon.osrm
```

**3. API 요청 형식은 기존 OSRM 형식을 사용합니다.**

아래 좌표는 DEM 안에 있는 요청 형식 예시이며 타슈 대여소를 검증한 좌표는 아닙니다.
실제 대여·반납 대여소 좌표로 바꿔 사용합니다.

```bash
curl 'http://localhost:5001/route/v1/bike/127.3845,36.3504;127.4000,36.3600?steps=true&geometries=geojson&overview=full'
```

`weight_name`은 `uphill`이며 `weight`는 사용자 정의 비용입니다.
`distance`는 실제 경로 거리, `duration`은 기존 자전거 프로필의 예상 시간입니다.
오르막 회피용 비용을 시간에 더하지 않았으므로 **duration은 고도에 따른 속도 저하를
반영하지 않습니다.** 정확한 예상 시간이 필요하면 경사별 속도 모델을 따로 적용합니다.
OSRM 응답에 누적 상승량이나 고도 그래프가 자동 추가되는 것은 아닙니다.

**4. 가중치와 정밀도 설정**

```lua
-- config.lua
distance_weight = 1.0,
ascent_weight = 30.0,
sample_step_m = 15.0,
steepness_weight = 0.0,
steep_grade_threshold = 0.05,
```

기본값에서는 1m 오르막을 평지 30m만큼의 비용으로 봅니다.
총 상승량이 같아도 더 가파른 오르막을 회피하려면 `steepness_weight`를 양수로
조정합니다. 급경사 비용은 각 샘플 구간의 `거리 × max(상승경사 - 0.05, 0)^2`의
합에 이 계수를 곱한 값입니다. 0.05는 5% 경사이며 각도가 아닙니다.

비용 계산 예시:

| 후보 | 거리 | 누적 상승량 | 기본 비용 |
| --- | --- | --- | --- |
| A | 1,000m | 50m | 2,500 |
| B | 1,500m | 5m | 1,650 |

이 경우 B가 선택됩니다. 실제 경로 선택은 도로망의 접근·방향 제약도 따릅니다.
도로 구간별로 `sum(max(0, 다음 고도 - 이전 고도))`를 계산하므로 내리막이 앞선
오르막을 상쇄하지 않습니다. `force_split_edges = true`로 왕복 비용을 따로 적용합니다.
OSM way 전체의 양 끝 고도만 사용하지 않고 각 OSM 노드 사이에서도 최대 15m 간격으로
샘플링합니다. 이 샘플링은 25~31m DEM에 없던 정밀 지형을 복원하지는 않습니다.

설정을 변경하면 `extract → partition → customize`부터 다시 수행하고 새 데이터로
서버를 재시작합니다. 요청마다 사용자가 계수를 자유롭게 바꾸는 기능은 구현하지 않았습니다.

**5. DEM을 다시 변환해야 하는 경우**

이 패키지의 DEM은 이미 변환되어 있어 OSRM 실행만 한다면 Python 설치가 필요 없습니다.
다른 DEM을 사용하거나 평활화 값을 바꾸려면 아래를 실행합니다.

```bash
python -m venv .venv
# Linux/macOS 활성화 예시
. .venv/bin/activate
python -m pip install -r requirements.txt
python prepare_dem.py ./dem/daejeon-dem.tif ./dem
```

다른 좌표계나 회전된 래스터는 EPSG:4326 정북 방향 격자로 재투영합니다.
이 입력 파일은 이미 해당 조건이므로 원본 격자를 재투영하거나 평활화하지 않았습니다.
선택적 평활화는 `pip install scipy` 후 `--smooth-sigma 0.75`처럼 지정합니다.
평활화는 노이즈와 함께 실제 짧은 언덕도 줄일 수 있어 비교 검증이 필요합니다.

OSRM의 기본 래스터는 GeoTIFF나 ESRI ASCII Grid 헤더를 직접 읽는 형식이 아닙니다.
`elevation.asc`는 **헤더 없는 정수 행렬**입니다. OSRM이 보간한 값도 정수로
반환하므로 데이터는 미터 값의 100배로 저장하고 조회 후 100으로 나눕니다.
이는 보간의 절삭 오차를 줄이기 위한 것이며 원본 수직 정확도가 1cm라는 뜻이 아닙니다.
래스터 범위에는 픽셀 외곽이 아닌 첫·마지막 픽셀 중심을 넘겨 반 픽셀 오차를 피합니다.
기본 보간기의 결측값 혼합 문제를 피하기 위해 변환기는 결측 픽셀이 있으면 중단합니다.

**검증 결과와 적용 한계**

2026-09-15, Python 3.12 / rasterio 1.5.1 / lupa 2.8에서 10개 검증을 통과했습니다.
실제 DEM 전체의 변환 전후 값 일치, 픽셀 중심 좌표·행 방향, 결측 처리,
상행·하행 비대칭, 중간 언덕, 평지 우회 선택, 급경사 추가 비용,
범위 밖 좌표 처리, 프로필 설정 및 duration 유지 등을 확인했습니다.

```bash
python -m pip install -r requirements-dev.txt
python -m unittest -v test_profile
```

테스트는 실제 Lua 비용 코드와 래스터/기본 프로필의 테스트 어댑터를 이용합니다.
**네이티브 OSRM의 extract/partition/customize/routed 통합 테스트는 수행하지 않았습니다.**
작업 환경에 OSRM 바이너리·Docker와 도로망 PBF가 없어 실제 대전 경로 결과까지
검증하지는 못했습니다. 배포 전 대표 경로를 기존 자전거 경로와 비교해야 합니다.

- DEM은 지표 고도이므로 교량 상판·고가도로·터널의 실제 주행 고도와 다를 수 있습니다.
  `process_segment`에는 OSM 태그가 전달되지 않으므로 구조물 보정은 별도 전처리가 필요합니다.
- 노이즈, 건물·수목 영향 및 낮은 해상도는 누적 상승량에 오차를 만들 수 있습니다.
- 부분 도로 구간에 스냅된 출발·도착점은 OSRM이 저장된 구간 비용을 비례 배분할 수 있어,
  구간 내부에 언덕이 있는 경우 부분 경로의 실제 상승량과 차이가 생길 수 있습니다.
- 회전 지연은 duration에만 남겨 둡니다. 회전 자체를 회피하도록 만드는 추가 비용은 없습니다.
- 기본 bicycle 프로필이 허용하는 `pushing_bike` 구간도 남아 있습니다. 자전거를
  끌어야 하는 경로까지 제외하려면 해당 모드에 대한 별도 정책을 추가해야 합니다.
- 비용 최소화는 모델·도로망·샘플링·OSRM 수치 정밀도 안에서의 결과입니다.
  실제 주행 상승량의 절대 최솟값을 보장한다는 의미는 아닙니다.

공식 근거:

- [OSRM 프로필 문서 — 가중치, process_segment, 래스터](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/profiles.md)
- [OSRM v5.27.1 래스터 구현 — 픽셀 중심 범위와 정수 보간](https://github.com/Project-OSRM/osrm-backend/blob/v5.27.1/src/extractor/raster_source.cpp)
- [OSRM v5.27.1 Lua 바인딩](https://github.com/Project-OSRM/osrm-backend/blob/v5.27.1/src/extractor/scripting_environment_lua.cpp)
- [OSRM v5.27.1 자전거 프로필](https://github.com/Project-OSRM/osrm-backend/blob/v5.27.1/profiles/bicycle.lua)
- [Rasterio 재투영 문서](https://rasterio.readthedocs.io/en/stable/topics/reproject.html)
