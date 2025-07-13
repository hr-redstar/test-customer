# Discord接客ログBot - Docker操作用Makefile

.PHONY: help build dev prod stop clean logs shell deploy-commands test

# デフォルトターゲット
help:
	@echo "📋 利用可能なコマンド:"
	@echo "  make build          - Dockerイメージをビルド"
	@echo "  make dev            - 開発モードで起動"
	@echo "  make prod           - 本番モードで起動"
	@echo "  make stop           - サービスを停止"
	@echo "  make clean          - 全てのコンテナとイメージを削除"
	@echo "  make logs           - ログを表示"
	@echo "  make shell          - コンテナにシェルでアクセス"
	@echo "  make deploy-commands - Discordスラッシュコマンドを登録"
	@echo "  make test           - ヘルスチェックを実行"

# 開発用イメージのビルド
build:
	@echo "🐳 Dockerイメージをビルド中..."
	docker-compose build

# 開発モードで起動
dev:
	@echo "🚀 開発モードで起動中..."
	docker-compose up --build

# 本番モードで起動
prod:
	@echo "🚀 本番モードで起動中..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# サービス停止
stop:
	@echo "⏹️ サービスを停止中..."
	docker-compose down

# クリーンアップ
clean:
	@echo "🧹 クリーンアップ中..."
	docker-compose down -v --rmi all --remove-orphans
	docker system prune -f

# ログ表示
logs:
	@echo "📋 ログを表示中..."
	docker-compose logs -f

# シェルアクセス
shell:
	@echo "🐚 コンテナにアクセス中..."
	docker-compose exec app /bin/bash

# Discordスラッシュコマンド登録
deploy-commands:
	@echo "📡 Discordスラッシュコマンドを登録中..."
	docker-compose exec app npm run deploy-commands

# ヘルスチェック
test:
	@echo "🔍 ヘルスチェック実行中..."
	curl -f http://localhost:8080/health || echo "❌ サービスが応答しません"

# インストール（初回セットアップ）
install:
	@echo "📦 初回セットアップ中..."
	@echo "1. .envファイルの設定を確認してください"
	@echo "2. make build でイメージをビルドしてください"
	@echo "3. make dev で開発を開始してください"
