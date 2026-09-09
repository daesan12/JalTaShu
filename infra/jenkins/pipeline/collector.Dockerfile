FROM python:3.12.14-slim-bookworm

WORKDIR /workspace
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY collect.py ./
COPY tests ./tests
RUN python -m unittest discover -s tests -v