.PHONY: help dev build test install stop

help:
	@echo "streaming-platform-upload targets:"
	@echo "  dev     - Start development server (port 3000)"
	@echo "  build   - Build for production"
	@echo "  test    - Run test suite"
	@echo "  install - Install dependencies"
	@echo "  stop    - Stop running instance"

install:
	npm install --legacy-peer-deps

dev:
	npm run dev

build:
	npm run build

test:
	npm test

stop:
	pkill -f "next dev" || true
	@echo "✓ Stopped streaming-platform-upload"
