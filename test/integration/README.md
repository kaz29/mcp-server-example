# 統合テストについて

## 現状

Vitest + NestJSの組み合わせで、統合テストにおけるDI(依存性注入)が正しく動作しない問題があります。
これはVitestがCommonJSプロジェクトで`reflect-metadata`を適切に処理できないためです。

## 代替テスト方法

統合テストは以下の手順で実行できます：

### 1. サーバーを起動

```bash
npm run build
npm start
```

### 2. 別ターミナルでE2Eテスト実行

```bash
npm run test:e2e
# または
node test/e2e/test-client.mjs
```

これにより、実際のHTTP経由でのMCPツール呼び出しが検証できます。

## 今後の改善案

- Jestへの移行（NestJSの標準テストフレームワーク）
- ESMプロジェクトへの移行
- Vitestのexperimentalな設定を使用
