# Google Cloud Run デプロイ用 PowerShell スクリプト
# 必要な変数を設定してください

# プロジェクトID、リージョン、サービス名、イメージ名を指定
$PROJECT_ID = "test-customer-discord-bot"   # ←ご自身のGCPプロジェクトIDに変更
$REGION = "asia-northeast1"           # ←ご希望のリージョンに変更
$SERVICE_NAME = "test-customer-bot" # ←サービス名を変更
$IMAGE_NAME = "gcr.io/test-customer-discord-bot/test_customer_bot:latest"

# gcloud認証（初回のみ必要）
# gcloud auth login
# gcloud config set project $PROJECT_ID

# Dockerイメージのビルド
Write-Host "Dockerイメージをビルド中..."
docker build -t $IMAGE_NAME .

# Google Container Registryへpush
Write-Host "イメージをGCRへpush中..."
gcloud auth configure-docker
docker push $IMAGE_NAME

# Cloud Runへデプロイ
Write-Host "Cloud Runへデプロイ中..."
gcloud run deploy $SERVICE_NAME --image $IMAGE_NAME --region $REGION --platform managed --allow-unauthenticated

Write-Host "Cloud Run deployment finished. Please check the service URL above."
