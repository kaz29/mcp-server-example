#!/bin/bash

# MCPサーバーを起動するスクリプト

echo "Simple MCP Serverを起動しています..."
echo "ビルドを実行中..."

npm run build

if [ $? -ne 0 ]; then
  echo "ビルドに失敗しました"
  exit 1
fi

echo "サーバーを起動中..."
node build/index.js
