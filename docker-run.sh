#!/bin/bash

# Docker環境での接客ログBot実行スクリプト

set -e

echo "🤖 接客ログBot Docker環境"
echo "=========================="

# 環境変数チェック
check_env() {
    if [ -z "$DISCORD_TOKEN" ]; then
        echo "❌ DISCORD_TOKENが設定されていません"
        exit 1
    fi
    
    if [ -z "$CLIENT_ID" ]; then
        echo "❌ CLIENT_IDが設定されていません"
        exit 1
    fi
    
    echo "✅ 環境変数チェック完了"
}

# Docker環境チェック
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Dockerがインストールされていません"
        echo "Docker Desktopをインストールしてください: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo "❌ Dockerが起動していません"
        echo "Docker Desktopを起動してください"
        exit 1
    fi
    
    echo "✅ Docker環境チェック完了"
}

# メイン処理
main() {
    case "${1:-help}" in
        "dev")
            echo "🚀 開発モードで起動中..."
            check_env
            check_docker
            docker-compose up --build
            ;;
        "prod")
            echo "🚀 本番モードで起動中..."
            check_env
            check_docker
            docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
            ;;
        "stop")
            echo "⏹️ サービス停止中..."
            docker-compose down
            ;;
        "logs")
            echo "📋 ログ表示中..."
            docker-compose logs -f
            ;;
        "commands")
            echo "📡 Discordスラッシュコマンド登録中..."
            check_env
            docker-compose exec app npm run deploy-commands
            ;;
        "health")
            echo "🔍 ヘルスチェック実行中..."
            curl -f http://localhost:8080/health && echo "✅ サービス正常" || echo "❌ サービス異常"
            ;;
        "help"|*)
            echo "使用方法: $0 {dev|prod|stop|logs|commands|health}"
            echo ""
            echo "コマンド:"
            echo "  dev      - 開発モードで起動"
            echo "  prod     - 本番モードで起動"
            echo "  stop     - サービス停止"
            echo "  logs     - ログ表示"
            echo "  commands - Discordコマンド登録"
            echo "  health   - ヘルスチェック"
            ;;
    esac
}

main "$@"
