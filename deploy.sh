#!/bin/bash

# Google Cloud Platform デプロイメントスクリプト

echo "🚀 接客ログBot GCPデプロイメント開始"

# 必要な環境変数チェック
if [ -z "$DISCORD_TOKEN" ]; then
    echo "❌ DISCORD_TOKENが設定されていません"
    exit 1
fi

if [ -z "$DISCORD_GUILD_ID" ]; then
    echo "❌ DISCORD_GUILD_IDが設定されていません"
    exit 1
fi

if [ -z "$DISCORD_CHANNEL_ID" ]; then
    echo "❌ DISCORD_CHANNEL_IDが設定されていません"
    exit 1
fi

if [ -z "$CLIENT_ID" ]; then
    echo "❌ CLIENT_IDが設定されていません"
    exit 1
fi

# Google Cloud プロジェクトの設定
echo "📝 Google Cloud プロジェクトの設定"
gcloud config set project $GOOGLE_CLOUD_PROJECT_ID

# 環境変数をapp.yamlに設定
echo "⚙️ 環境変数の設定"
gcloud app deploy --set-env-vars DISCORD_TOKEN=$DISCORD_TOKEN,DISCORD_GUILD_ID=$DISCORD_GUILD_ID,DISCORD_CHANNEL_ID=$DISCORD_CHANNEL_ID,CLIENT_ID=$CLIENT_ID

echo "✅ デプロイメント完了！"
echo "🌐 アプリケーションURL: https://$GOOGLE_CLOUD_PROJECT_ID.appspot.com"
