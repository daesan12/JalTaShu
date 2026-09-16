# AI 서빙(tashu-ai/src/serve.py) 실행 image. build context = tashu-ai/
# 실행: 모델 3파일(lgbm_lambda.joblib, lgbm_mu.joblib, station_profile.parquet)을
#       /workspace/artifacts/models 에 volume mount, 접속 정보는 --env-file(mysql-reader.env 등)로 주입.
FROM python:3.12.14-slim-bookworm

WORKDIR /workspace
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Seoul

# lightgbm wheel은 OpenMP 런타임(libgomp)이 필요 — slim image에 없다
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY config.py ./
COPY src ./src
COPY tests ./tests
# 데이터·모델이 필요한 테스트는 skip, 나머지(계약 검수·서빙 로직)로 image를 검증한다
RUN python -m pytest tests -q

CMD ["python", "-m", "src.serve"]
