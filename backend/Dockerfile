FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create upload dirs — uploads/tmp is used as scratch space for transcription.
# Primary storage is Supabase; local dir is only for temp files during processing.
RUN mkdir -p uploads/tmp

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
