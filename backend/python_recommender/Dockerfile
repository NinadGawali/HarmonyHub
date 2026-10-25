FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

ENV PYTHON_RECOMMENDER_HOST=0.0.0.0
ENV PYTHON_RECOMMENDER_PORT=5001

EXPOSE 5001

CMD ["python", "app.py"]
