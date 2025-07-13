# Node.js 20を使用
FROM node:20-slim

# 必要なパッケージをインストール（ヘルスチェック用）
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー    # package.jsonをコピー
    COPY package.json ./
    
    # 依存関係をインストール（エラーハンドリング強化）
    RUN npm install --omit=dev --no-audit --no-fund || \
        (echo "npm install failed" && exit 1)

# アプリケーションのソースコードをコピー
COPY . .

# ポート8080を公開
EXPOSE 8080

# ヘルスチェックを追加
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 非rootユーザーを作成
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# アプリケーションを起動（エラーハンドリング付き）
CMD ["npm", "start"]
