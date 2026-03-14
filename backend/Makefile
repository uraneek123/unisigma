check:
	ruff format .
	ruff check .

test:
	pytest tests/

.PHONY: coverage

coverage:
	pytest --cov --cov-report=html:coverage --cov-fail-under=70