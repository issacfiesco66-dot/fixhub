FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY pyproject.toml README.md ./
COPY app ./app

# INSTALL_VISION=1 añade ultralytics/torch (imagen mucho más grande; usa una base CUDA si hay GPU).
ARG INSTALL_VISION=0
RUN pip install -e . && \
    if [ "$INSTALL_VISION" = "1" ]; then pip install -e ".[vision]"; fi

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1
CMD ["uvicorn", "--factory", "app.main:create_app", "--host", "0.0.0.0", "--port", "8000"]
