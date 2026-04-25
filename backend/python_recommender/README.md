# Python Recommender Service

This service handles LangChain-based playlist recommendations.

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

   pip install -r requirements.txt

3. Configure environment variables (example):

   set GOOGLE_API_KEY=your_key_here
   set PYTHON_RECOMMENDER_PORT=5001

4. Run service:

   python app.py

## Endpoints

- GET /health
- POST /recommend/ai
- POST /recommend/location
