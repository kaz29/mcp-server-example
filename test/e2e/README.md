# E2Eテスト

実際のHTTP経由でMCPサーバーの動作を検証します。

## 実行方法

### 手動実行

```bash
# ターミナル1: サーバー起動
npm run build
npm start

# ターミナル2: E2Eテスト実行
npm run test:e2e
```

### テスト内容

- `test-client.mjs`: 全5つのMCPツールを実際に呼び出して動作確認
  - get_current_time
  - calculate (add/subtract/multiply/divide)
  - save_note
  - get_note
  - list_notes

## 注意事項

- サーバーが起動していることが前提
- ポート3000が使用可能である必要がある
- NotesServiceはインメモリなので、サーバー再起動で初期化される
