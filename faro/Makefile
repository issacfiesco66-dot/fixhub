.PHONY: backend-install backend-test backend-lint backend-dev mobile-setup mobile-test

backend-install:
	cd backend && python -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"

backend-test:
	cd backend && . .venv/bin/activate && pytest -q

backend-lint:
	cd backend && . .venv/bin/activate && ruff check app tests && ruff format --check app tests

backend-dev:
	cd backend && . .venv/bin/activate && uvicorn --factory app.main:create_app --reload --port 8000

mobile-setup:
	cd mobile && flutter create . --org app.faro --project-name faro_app --platforms=android,ios && flutter pub get

mobile-test:
	cd mobile && flutter analyze && flutter test
