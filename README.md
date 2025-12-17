# 動画逆回転アプリ

動画をアップロードすると、その動画の逆回転（逆再生）動画を生成するWebアプリケーションです。

## 機能

- 動画ファイルのアップロード（ドラッグ&ドロップ対応）
- 元動画と同じ長さ・FPSで正確に逆再生された動画を生成
- 逆回転動画のプレビューとダウンロード

## ローカルでの実行方法

### 必要な環境

- Node.js（v14以上推奨）
- FFmpeg（コマンドラインで `ffmpeg` が使えること）

### MacでのFFmpegインストール

```bash
brew install ffmpeg
```

### セットアップと起動

```bash
# 依存パッケージのインストール
npm install

# サーバー起動
npm start
```

ブラウザで `http://localhost:3000` にアクセスしてください。

## デプロイ方法

このアプリはFFmpegが必要なため、FFmpegが利用できるホスティングサービスにデプロイする必要があります。

### Railway でのデプロイ（推奨）

1. **Railwayアカウント作成**
   - https://railway.app にアクセス
   - GitHubアカウントでサインアップ

2. **プロジェクト作成**
   - "New Project" → "Deploy from GitHub repo"
   - このリポジトリを選択

3. **FFmpegのインストール設定**
   - Railwayのダッシュボードで、プロジェクトの "Settings" → "Variables" を開く
   - または、プロジェクトルートに `railway.json` を作成（下記参照）

4. **環境変数の設定**
   - `PORT` は自動設定されるため、追加設定不要

5. **デプロイ**
   - GitHubにプッシュすると自動デプロイされます

**railway.json の例：**
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**nixpacks.toml を作成（FFmpegインストール用）：**
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x", "ffmpeg"]

[phases.install]
cmds = ["npm install"]

[start]
cmd = "npm start"
```

### Render でのデプロイ

1. **Renderアカウント作成**
   - https://render.com にアクセス
   - GitHubアカウントでサインアップ

2. **新しいWebサービス作成**
   - "New" → "Web Service"
   - GitHubリポジトリを接続

3. **設定**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

4. **FFmpegのインストール**
   - Renderのダッシュボードで "Environment" タブを開く
   - 以下の環境変数を追加：
     ```
     FFMPEG_PATH=/usr/bin/ffmpeg
     ```
   - または、`render.yaml` を作成（下記参照）

**render.yaml の例：**
```yaml
services:
  - type: web
    name: reversevid
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

### Fly.io でのデプロイ

1. **Fly.io CLIのインストール**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **ログイン**
   ```bash
   fly auth login
   ```

3. **アプリ作成**
   ```bash
   fly launch
   ```

4. **Dockerfile を作成**（FFmpegを含む）
   ```dockerfile
   FROM node:18-slim

   # FFmpegのインストール
   RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .

   EXPOSE 3000
   CMD ["npm", "start"]
   ```

5. **デプロイ**
   ```bash
   fly deploy
   ```

### Heroku でのデプロイ

1. **Herokuアカウント作成**
   - https://www.heroku.com にアクセス
   - アカウントを作成（有料プランが必要な場合があります）

2. **Heroku CLIのインストール**
   ```bash
   # Macの場合
   brew tap heroku/brew && brew install heroku
   
   # または公式インストーラーを使用
   # https://devcenter.heroku.com/articles/heroku-cli
   ```

3. **Herokuにログイン**
   ```bash
   heroku login
   ```

4. **Herokuアプリを作成**
   ```bash
   heroku create your-app-name
   ```

5. **FFmpeg Buildpackを追加**
   ```bash
   heroku buildpacks:add --index 1 https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
   heroku buildpacks:add --index 2 heroku/nodejs
   ```

6. **GitHubにプッシュしてデプロイ**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add heroku https://git.heroku.com/your-app-name.git
   git push heroku main
   ```

   **または、GitHub連携を使用する場合：**
   - Herokuダッシュボードで "Deploy" タブを開く
   - "Connect to GitHub" をクリック
   - リポジトリを選択して "Enable Automatic Deploys" を有効化

7. **アプリを開く**
   ```bash
   heroku open
   ```

**注意事項：**
- Herokuは2022年11月に無料プランを終了しました。有料プラン（Eco Dyno: $5/月）が必要です
- FFmpeg Buildpackを使用することで、FFmpegが自動的にインストールされます
- `PORT` 環境変数は自動的に設定されます

### DigitalOcean App Platform でのデプロイ

1. **DigitalOceanアカウント作成**
   - https://www.digitalocean.com にアクセス

2. **App Platformで新規アプリ作成**
   - "Create" → "Apps" → "GitHub" を選択
   - リポジトリを選択

3. **設定**
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
   - **Environment Variables**: `PORT` は自動設定

4. **FFmpegのインストール**
   - App Specで `apt-get install ffmpeg` を実行する設定を追加
   - または、Dockerfileを使用

## 注意事項

- 動画ファイルは一時的にサーバーに保存されますが、処理後は自動削除されます
- 大きな動画ファイルの処理には時間がかかる場合があります
- デプロイ先のサービスによっては、ファイルサイズや処理時間に制限がある場合があります

## ライセンス

MIT

