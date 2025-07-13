#!/bin/bash

# Cloud Run デプロイメントスクリプト

echo "🚀 接客ログBot Cloud Runデプロイメント開始"

# 設定値
SERVICE_NAME="service-log-bot"
REGION="asia-northeast1"
PLATFORM="managed"

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

if [ -z "$GOOGLE_CLOUD_PROJECT_ID" ]; then
    echo "❌ GOOGLE_CLOUD_PROJECT_IDが設定されていません"
    exit 1
fi

# Google Cloud プロジェクトの設定
echo "📝 Google Cloud プロジェクトの設定"
gcloud config set project $GOOGLE_CLOUD_PROJECT_ID

# 必要なAPIを有効化
echo "🔧 必要なAPIを有効化"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com

# Dockerイメージをビルドして Container Registry にプッシュ
echo "🐳 Dockerイメージのビルドとプッシュ"
IMAGE_NAME="gcr.io/$GOOGLE_CLOUD_PROJECT_ID/$SERVICE_NAME"
gcloud builds submit --tag $IMAGE_NAME .

# Cloud Runにデプロイ
echo "☁️ Cloud Runにデプロイ"
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform $PLATFORM \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars "DISCORD_TOKEN=$DISCORD_TOKEN,DISCORD_GUILD_ID=$DISCORD_GUILD_ID,DISCORD_CHANNEL_ID=$DISCORD_CHANNEL_ID,CLIENT_ID=$CLIENT_ID,PORT=8080,NODE_ENV=production"

# サービスURLを取得
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform=$PLATFORM --region=$REGION --format="value(status.url)")

echo "✅ デプロイメント完了！"
echo "🌐 サービスURL: $SERVICE_URL"
echo "📊 Cloud Run コンソール: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
