# Config Directory

このディレクトリには GitHub App の秘密鍵を配置します。

## GitHub App Private Key の配置

1. GitHub App の作成後、Private Key をダウンロード
2. このディレクトリに配置:
   ```bash
   cp ~/Downloads/your-app.*.private-key.pem ./config/github-app-private-key.pem
   ```
3. パーミッションを制限:
   ```bash
   chmod 600 ./config/github-app-private-key.pem
   ```

## 注意事項

- `.gitignore` で `*.pem` が除外されているため、秘密鍵がコミットされることはありません
- `.env` ファイルの `GITHUB_PRIVATE_KEY_PATH` でこのファイルのパスを指定してください
