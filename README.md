# requesta-cloudwatch-slack-notification

CloudWatch Alarm を Slack に通知する Lambda 関数（AWS SAR アプリケーション）

## 概要

- CloudWatch Alarm → SNS → Lambda → Slack Webhook
- エラーログの詳細を自動取得して Slack に添付
- AWS Serverless Application Repository (SAR) で公開・配布
- 環境ごとに独立した SAR アプリケーションとして管理

## 環境とブランチの対応

| ブランチ | 環境 | SAR アプリケーション名 |
|---------|------|----------------------|
| develop | dev | `requesta-cloudwatch-slack-notification-dev` |
| staging | stg | `requesta-cloudwatch-slack-notification-stg` |
| master | prd | `requesta-cloudwatch-slack-notification` |

## 開発環境

### 必要なツール

- Node.js 22.x
- AWS SAM CLI
- AWS CLI
- Docker（SAM build に必要）

### セットアップ

```bash
# 依存関係インストール
npm install

# TypeScript ビルド
npm run build

# SAM ビルド
sam build --use-container

# ローカルテスト（オプション）
sam local invoke -e events/test-event.json
```

### ディレクトリ構成

```
requesta-cloudwatch-slack-notification/
├── .github/
│   └── workflows/
│       └── cicd.yml          # GitHub Actions ワークフロー
├── src/
│   ├── index.ts              # Lambda ハンドラー
│   ├── types.ts              # 型定義
│   ├── constants.ts          # 定数
│   ├── Sns.ts                # SNS イベント処理
│   ├── CloudWatchLogs.ts     # CloudWatch Logs 取得
│   └── Slack.ts              # Slack 通知
├── dist/                     # ビルド出力（.gitignore）
├── template.yml              # SAM テンプレート
├── samconfig.toml            # SAM 設定
├── tsconfig.json             # TypeScript 設定
├── Makefile                  # SAM カスタムビルド
└── package.json
```

---

## CI/CD セットアップ

### 概要

各ブランチへの push で対応する環境の SAR に自動公開されます：

- **develop** → dev 環境 SAR
- **staging** → stg 環境 SAR
- **master** → prd 環境 SAR

### 前提条件

このリポジトリは `requesta-server` と同じ AWS アカウント・IAM Role を使用します。
`requesta-server` の CI/CD が先にセットアップされている必要があります。

---

### Step 1: S3 バケットポリシーの追加

既存の `requesta-[env]-cicd` バケットを再利用します。
SAR がアーティファクトを読み取れるよう、各バケットにポリシーを追加します。

```bash
# 各環境のバケットに対して実行（例: dev）
BUCKET_NAME=requesta-dev-cicd
AWS_ACCOUNT_ID=123456789012  # 実際のアカウントIDに置き換え

# 現在のバケットポリシーを取得
aws s3api get-bucket-policy --bucket $BUCKET_NAME --query Policy --output text > /tmp/current-policy.json

# SAR 用のステートメントを追加したポリシーを作成
# 既存ポリシーがある場合は Statement 配列に以下を追加：
cat > /tmp/sar-statement.json << EOF
{
  "Sid": "AllowSARAccess",
  "Effect": "Allow",
  "Principal": {
    "Service": "serverlessrepo.amazonaws.com"
  },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::$BUCKET_NAME/*",
  "Condition": {
    "StringEquals": {
      "aws:SourceAccount": "$AWS_ACCOUNT_ID"
    }
  }
}
EOF

# バケットポリシーを更新（既存ポリシーと統合）
# 既存ポリシーがない場合は新規作成
aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowSARAccess",
        "Effect": "Allow",
        "Principal": {
          "Service": "serverlessrepo.amazonaws.com"
        },
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*",
        "Condition": {
          "StringEquals": {
            "aws:SourceAccount": "'$AWS_ACCOUNT_ID'"
          }
        }
      }
    ]
  }'
```

> 既存のバケットポリシーがある場合は、上記の Statement を既存の Statement 配列に追加してください。

対象バケット:
- `requesta-dev-cicd`
- `requesta-stg-cicd`
- `requesta-prd-cicd`

---

### Step 2: IAM Role への権限追加

各環境の IAM Role（`requesta-{env}-github-cicd-role`）に SAR 関連の権限を追加します。

#### 追加が必要な権限

```json
{
  "Effect": "Allow",
  "Action": [
    "serverlessrepo:CreateApplication",
    "serverlessrepo:CreateApplicationVersion",
    "serverlessrepo:UpdateApplication",
    "serverlessrepo:GetApplication",
    "serverlessrepo:ListApplicationVersions"
  ],
  "Resource": [
    "arn:aws:serverlessrepo:ap-northeast-1:{AWS_ACCOUNT_ID}:applications/requesta-cloudwatch-slack-notification",
    "arn:aws:serverlessrepo:ap-northeast-1:{AWS_ACCOUNT_ID}:applications/requesta-cloudwatch-slack-notification-dev",
    "arn:aws:serverlessrepo:ap-northeast-1:{AWS_ACCOUNT_ID}:applications/requesta-cloudwatch-slack-notification-stg"
  ]
}
```

---

### Step 3: IAM Role の信頼関係更新

各環境の IAM Role の信頼関係に、このリポジトリからのアクセスを追加：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::{AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:{GITHUB_ORG}/requesta-server:ref:refs/heads/*",
            "repo:{GITHUB_ORG}/requesta-cloudwatch-slack-notification:ref:refs/heads/*"
          ]
        }
      }
    }
  ]
}
```

> `{AWS_ACCOUNT_ID}` と `{GITHUB_ORG}` を実際の値に置き換えてください。

---

### Step 4: GitHub Secrets 設定

GitHub リポジトリの Settings → Secrets and variables → Actions から以下を登録：

| Secret 名 | 値 | 説明 |
|-----------|-----|------|
| `CI_DEV_DEPLOY_IAM_ROLE` | `arn:aws:iam::{AWS_ACCOUNT_ID}:role/requesta-dev-github-cicd-role` | dev 環境用 IAM Role |
| `CI_STG_DEPLOY_IAM_ROLE` | `arn:aws:iam::{AWS_ACCOUNT_ID}:role/requesta-stg-github-cicd-role` | stg 環境用 IAM Role |
| `CI_PRD_DEPLOY_IAM_ROLE` | `arn:aws:iam::{AWS_ACCOUNT_ID}:role/requesta-prd-github-cicd-role` | prd 環境用 IAM Role |
| `CI_DEV_SAR_S3_BUCKET` | `requesta-dev-cicd` | dev 環境用 S3 バケット（既存） |
| `CI_STG_SAR_S3_BUCKET` | `requesta-stg-cicd` | stg 環境用 S3 バケット（既存） |
| `CI_PRD_SAR_S3_BUCKET` | `requesta-prd-cicd` | prd 環境用 S3 バケット（既存） |

> **Note**: S3 バケットは `requesta-server` と同じバケットを再利用します。

---

### Step 5: 動作確認

1. `develop` ブランチに push → dev 環境 SAR に公開
2. `staging` ブランチに push → stg 環境 SAR に公開
3. `master` ブランチに push → prd 環境 SAR に公開

#### SAR 公開確認

```bash
# SAR アプリケーション一覧
aws serverlessrepo list-applications --region ap-northeast-1

# アプリケーション詳細（dev 環境）
aws serverlessrepo get-application \
  --application-id arn:aws:serverlessrepo:ap-northeast-1:{AWS_ACCOUNT_ID}:applications/requesta-cloudwatch-slack-notification-dev
```

---

## requesta-server との連携

### template.yaml の Mappings

`requesta-server/template.yaml` に以下の Mappings が設定されています：

```yaml
Mappings:
  Notification:
    dev:
      AppArn: 'arn:aws:serverlessrepo:ap-northeast-1:{AWS_ACCOUNT_ID}:applications/requesta-cloudwatch-slack-notification-dev'
    stg:
      AppArn: 'arn:aws:serverlessrepo:ap-northeast-1:{AWS_ACCOUNT_ID}:applications/requesta-cloudwatch-slack-notification-stg'
    prd:
      AppArn: 'arn:aws:serverlessrepo:ap-northeast-1:{AWS_ACCOUNT_ID}:applications/requesta-cloudwatch-slack-notification'
```

### Slack Webhook URL パラメータ

`requesta-server` デプロイ時に `SlackWebhookUrl` パラメータを渡す必要があります。

GitHub Secrets に追加（requesta-server リポジトリ）：

| Secret 名 | 値 | 説明 |
|-----------|-----|------|
| `CI_DEV_SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/xxx` | dev 環境用 |
| `CI_STG_SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/xxx` | stg 環境用 |
| `CI_PRD_SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/xxx` | prd 環境用 |

---

## セットアップチェックリスト

### AWS 側

- [ ] S3 バケット `requesta-dev-cicd` に SAR 用ポリシー追加
- [ ] S3 バケット `requesta-stg-cicd` に SAR 用ポリシー追加
- [ ] S3 バケット `requesta-prd-cicd` に SAR 用ポリシー追加
- [ ] IAM Role `requesta-dev-github-cicd-role` に SAR 権限追加
- [ ] IAM Role `requesta-stg-github-cicd-role` に SAR 権限追加
- [ ] IAM Role `requesta-prd-github-cicd-role` に SAR 権限追加
- [ ] 各 IAM Role の信頼関係にこのリポジトリを追加

### GitHub 側（このリポジトリ）

- [ ] Secret `CI_DEV_DEPLOY_IAM_ROLE` 登録
- [ ] Secret `CI_STG_DEPLOY_IAM_ROLE` 登録
- [ ] Secret `CI_PRD_DEPLOY_IAM_ROLE` 登録
- [ ] Secret `CI_DEV_SAR_S3_BUCKET` 登録
- [ ] Secret `CI_STG_SAR_S3_BUCKET` 登録
- [ ] Secret `CI_PRD_SAR_S3_BUCKET` 登録

### GitHub 側（requesta-server リポジトリ）

- [ ] Secret `CI_DEV_SLACK_WEBHOOK_URL` 登録
- [ ] Secret `CI_STG_SLACK_WEBHOOK_URL` 登録
- [ ] Secret `CI_PRD_SLACK_WEBHOOK_URL` 登録

### 動作確認

- [ ] develop ブランチ push で dev SAR 公開成功
- [ ] staging ブランチ push で stg SAR 公開成功
- [ ] master ブランチ push で prd SAR 公開成功

---

## トラブルシューティング

### エラー: "Unable to upload artifact to S3"

**原因**: S3 バケットが存在しない、またはアクセス権がない

**解決策**:
1. S3 バケットが存在するか確認
2. IAM Role に `s3:PutObject` 権限があるか確認

### エラー: "User is not authorized to perform: serverlessrepo:CreateApplication"

**原因**: IAM Role に SAR 権限がない

**解決策**: Step 2 の SAR 権限を追加

### エラー: "The bucket policy does not allow SAR to access"

**原因**: S3 バケットに SAR 用のポリシーが設定されていない

**解決策**: Step 1 の SAR 用バケットポリシーを既存のバケットポリシーに追加

---

## バージョン管理

SAR のバージョンは `template.yml` の `SemanticVersion` で管理：

```yaml
Metadata:
  AWS::ServerlessRepo::Application:
    SemanticVersion: 0.0.1  # ← ここを更新
```

新機能追加時は SemanticVersion を更新してから push してください。

---

## 開発フロー

1. `develop` ブランチで開発・テスト
2. dev 環境で動作確認
3. `staging` ブランチにマージ
4. stg 環境で動作確認
5. `master` ブランチにマージ
6. prd 環境に反映
