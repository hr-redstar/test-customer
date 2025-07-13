# 接客ログBot (Discord + Google Cloud Platform対応)

Discord BotとWebアプリケーションの両方で動作する接客ログ管理システムです。Google Cloud Platformでの運用に対応しています。

## 機能

- 📝 **接客ログ入力**: 人数・金額・時間・サービス等の入力
- ⏰ **自動リマインダー**: 時間前（10分前）に自動通知（Discord & Web）
- 🎯 **タップ選択**: 延長・ハーフ・終了をタップで選択
- 📋 **店況・掲示板**: 自動で転送・表示
- 🤖 **Discord Bot**: スラッシュコマンドとボタンUIでの操作
- ☁️ **GCP対応**: Google Cloud Platformでの運用

## Discord Bot機能

### スラッシュコマンド
- `/service start` - 新規接客開始
- `/service list` - 現在のアクティブな接客一覧
- `/service end` - 接客終了

### リマインダー機能
- 10分前に自動でDiscordに通知
- ボタンクリックで延長・ハーフ・終了を選択可能

## セットアップ

### 1. 依存パッケージのインストール
```bash
npm install
```

### 2. Discord Bot設定

#### Discord Botの作成
1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 「New Application」をクリック
3. アプリケーション名を入力
4. 「Bot」タブでBotを作成
5. Tokenをコピー

#### Bot権限の設定
必要な権限:
- Send Messages
- Use Slash Commands
- Embed Links
- Read Message History

#### サーバーへの招待
OAuth2 URL Generator で以下を選択:
- Scope: `bot`, `applications.commands`
- Bot Permissions: 上記の権限

### 3. 環境変数の設定
`.env`ファイルに以下を設定:
```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_GUILD_ID=your_guild_id_here
DISCORD_CHANNEL_ID=your_channel_id_here
CLIENT_ID=your_client_id_here
GOOGLE_CLOUD_PROJECT_ID=your_project_id_here
```

### 4. スラッシュコマンドの登録
```bash
node deploy-commands.js
```

### 5. サーバー起動
```bash
npm start
```

## Docker環境でのセットアップ

### 1. 必要なソフトウェアのインストール

#### Docker Desktopのインストール
1. [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)をダウンロード
2. .dmgファイルを開いてDockerをアプリケーションフォルダにドラッグ
3. Docker Desktopを起動して初期設定を完了

### 2. Docker環境での起動

#### 簡単な起動方法（Makefileを使用）
```bash
# ヘルプを表示
make help

# 開発モードで起動
make dev

# 本番モードで起動
make prod

# サービス停止
make stop

# ログ確認
make logs

# Discordコマンド登録
make deploy-commands
```

#### 手動での起動方法
```bash
# 開発モードで起動
docker-compose up --build

# バックグラウンドで起動
docker-compose up -d --build

# 本番モードで起動
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# サービス停止
docker-compose down
```

#### スクリプトを使用した起動
```bash
# 実行権限を付与
chmod +x docker-run.sh

# 開発モードで起動
./docker-run.sh dev

# 本番モードで起動
./docker-run.sh prod

# ヘルスチェック
./docker-run.sh health
```

### 3. Docker環境の利点

- **環境の一貫性**: ローカル、開発、本番で同じ環境
- **簡単なセットアップ**: Node.jsのインストール不要
- **分離された環境**: ホストシステムに影響なし
- **スケーラビリティ**: 複数インスタンスの簡単な起動
- **ヘルスチェック**: 自動的な死活監視

### 4. 開発時の便利な機能

```bash
# コンテナ内でシェルを実行
docker-compose exec app /bin/bash

# リアルタイムログ監視
docker-compose logs -f app

# 特定のコマンドを実行
docker-compose exec app npm run deploy-commands
```

## Google Cloud Run デプロイ

### 1. GCP CLI セットアップ
```bash
# Google Cloud CLIのインストール（macOS）
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### 2. プロジェクトの作成・設定
```bash
# プロジェクト作成
gcloud projects create your-project-id

# プロジェクト設定
gcloud config set project your-project-id

# 必要なAPIを有効化
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

### 3. 環境変数の設定
```bash
export DISCORD_TOKEN="your_discord_bot_token"
export DISCORD_GUILD_ID="your_guild_id"
export DISCORD_CHANNEL_ID="your_channel_id"
export CLIENT_ID="your_client_id"
export GOOGLE_CLOUD_PROJECT_ID="your_project_id"
```

### 4. Cloud Runデプロイ実行
```bash
# Cloud Runデプロイスクリプト実行
./deploy-cloudrun.sh

# または手動デプロイ
npm run docker-build
gcloud builds submit --tag gcr.io/PROJECT_ID/service-log-bot
gcloud run deploy service-log-bot \
    --image gcr.io/PROJECT_ID/service-log-bot \
    --platform managed \
    --region asia-northeast1 \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars "DISCORD_TOKEN=$DISCORD_TOKEN,..."
```

### 5. ローカルDockerテスト
```bash
# Dockerイメージビルド
npm run docker-build

# ローカル実行
npm run docker-run
```

## 使用方法

### Webアプリケーション
1. ブラウザで http://localhost:8080 にアクセス（ローカル）
2. フォームから接客情報を入力
3. リマインダーをタップで操作

### Discord Bot
1. `/service start` で接客開始
   - 人数、サービス、金額、時間を選択
2. `/service list` で現在の状況確認
3. リマインダー通知で延長・ハーフ・終了を選択
4. `/service end` で手動終了

## API エンドポイント

- `POST /api/service/start` - 接客開始
- `POST /api/service/end` - 接客終了
- `POST /api/service/extend` - 接客延長
- `GET /api/services/active` - アクティブな接客一覧取得

## 技術仕様

- **バックエンド**: Node.js + Express
- **Discord**: Discord.js v14
- **リアルタイム通信**: Socket.io
- **スケジューリング**: node-cron
- **フロントエンド**: HTML5 + CSS3 + JavaScript
- **日時処理**: Moment.js
- **コンテナ**: Docker
- **クラウド**: Google Cloud Run

## ファイル構成

```
├── server.js                  # メインサーバーファイル
├── deploy-commands.js          # Discord スラッシュコマンド登録
├── Dockerfile                 # 本番用Docker設定
├── Dockerfile.dev             # 開発用Docker設定
├── docker-compose.yml         # Docker Compose設定
├── docker-compose.prod.yml    # 本番用Docker Compose設定
├── docker-run.sh              # Docker実行スクリプト
├── Makefile                   # Docker操作用Makefile
├── cloudrun.yaml              # Cloud Run設定
├── deploy-cloudrun.sh         # Cloud Runデプロイスクリプト
├── .dockerignore              # Dockerビルド除外ファイル
├── .env                       # 環境変数（秘匿情報）
├── package.json               # 依存関係
├── public/
│   ├── index.html             # Webアプリメイン画面
│   ├── style.css              # スタイルシート
│   └── script.js              # フロントエンド JavaScript
└── README.md                  # このファイル
```

## エラーハンドリング機能

### サーバーサイド
- **プロセスレベル**: 未処理の例外・Promise拒否をキャッチ
- **API レベル**: 入力値検証とエラーレスポンス
- **Discord Bot**: 接続エラー・メッセージ送信失敗の処理
- **Graceful Shutdown**: SIGTERM/SIGINTでの安全な終了
- **ヘルスチェック**: `/health` エンドポイントでサービス状態監視

### クライアントサイド
- **グローバルエラー**: 予期しないJavaScriptエラーをキャッチ
- **Socket.io**: 接続断・再接続の自動処理
- **API通信**: ネットワークエラー・タイムアウトの処理
- **フォーム検証**: 入力値チェックとユーザーフィードバック

### Docker/Cloud Run
- **ヘルスチェック**: コンテナの生存確認
- **リソース制限**: メモリ・CPU使用量の監視
- **自動復旧**: 異常終了時の自動再起動

## 注意事項

- `.env`ファイルは本番環境では使用せず、環境変数で設定してください
- Discord Botトークンは絶対に公開しないでください
- Cloud Runの料金に注意してください（無料枠: 月2M回のリクエスト）
- WebSocketの永続接続はCloud Runでは制限があるため、Socket.ioのポーリングモードが使用されます
- エラーログは本番環境では適切なログ収集システムに送信することを推奨します
