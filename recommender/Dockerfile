FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHON_RECOMMENDER_HOST=0.0.0.0 \
    PYTHON_RECOMMENDER_PORT=5001

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN useradd --create-home --uid 10001 recommender
USER recommender

EXPOSE 5001

CMD ["python", "-m", "app"]
