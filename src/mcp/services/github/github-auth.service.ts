import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createAppAuth } from '@octokit/auth-app';
import * as fs from 'fs';
import * as path from 'path';
import { GitHubAppConfig } from '../../types/github.types';

/**
 * GitHub App 認証サービス
 *
 * GitHub App として認証し、Installation Token を取得・管理します。
 * Installation Token は1時間有効で、期限が近づくと自動的に更新されます。
 */
@Injectable()
export class GitHubAuthService implements OnModuleInit {
  private readonly logger = new Logger(GitHubAuthService.name);
  private config: GitHubAppConfig;
  private auth: ReturnType<typeof createAppAuth>;
  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  async onModuleInit() {
    this.config = this.loadConfig();
    this.auth = createAppAuth({
      appId: this.config.appId,
      privateKey: this.config.privateKey,
      installationId: this.config.installationId,
    });

    // 初期化時に認証をテスト
    await this.validateAuthentication();
  }

  /**
   * 環境変数から GitHub App 設定を読み込む
   */
  private loadConfig(): GitHubAppConfig {
    const appId = process.env.GITHUB_APP_ID;
    const installationId = process.env.GITHUB_INSTALLATION_ID;
    const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
    const privateKeyEnv = process.env.GITHUB_PRIVATE_KEY;
    const baseUrl = process.env.GITHUB_BASE_URL;

    if (!appId || !installationId) {
      throw new Error(
        'GITHUB_APP_ID と GITHUB_INSTALLATION_ID は必須です。.env ファイルを確認してください。',
      );
    }

    let privateKey: string;

    // Private Key の読み込み（パス優先）
    if (privateKeyPath) {
      const fullPath = path.resolve(process.cwd(), privateKeyPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(
          `GitHub App の秘密鍵が見つかりません: ${fullPath}\n` +
            'docs/GITHUB_APP_SETUP.md を参照して秘密鍵を配置してください。',
        );
      }
      privateKey = fs.readFileSync(fullPath, 'utf-8');
      this.logger.log(`秘密鍵を読み込みました: ${privateKeyPath}`);
    } else if (privateKeyEnv) {
      // 環境変数から読み込み（改行コードを変換）
      privateKey = privateKeyEnv.replace(/\\n/g, '\n');
      this.logger.log('秘密鍵を環境変数から読み込みました');
    } else {
      throw new Error(
        'GITHUB_PRIVATE_KEY_PATH または GITHUB_PRIVATE_KEY のいずれかが必要です。',
      );
    }

    return {
      appId: parseInt(appId, 10),
      installationId: parseInt(installationId, 10),
      privateKey,
      baseUrl,
    };
  }

  /**
   * Installation Token を取得（キャッシュ付き）
   *
   * トークンが存在し、有効期限まで5分以上ある場合はキャッシュを返します。
   * そうでない場合は新しいトークンを取得します。
   */
  async getInstallationToken(): Promise<string> {
    const now = new Date();

    // キャッシュが有効か確認（有効期限の5分前まで使用）
    if (this.cachedToken && this.tokenExpiresAt) {
      const fiveMinutesBeforeExpiry = new Date(
        this.tokenExpiresAt.getTime() - 5 * 60 * 1000,
      );
      if (now < fiveMinutesBeforeExpiry) {
        this.logger.debug('キャッシュされたトークンを使用');
        return this.cachedToken;
      }
    }

    // 新しいトークンを取得
    this.logger.log('新しい Installation Token を取得中...');
    const { token, expiresAt } = await this.auth({
      type: 'installation',
    });

    this.cachedToken = token;
    this.tokenExpiresAt = new Date(expiresAt);

    this.logger.log(
      `Installation Token を取得しました（有効期限: ${this.tokenExpiresAt.toISOString()}）`,
    );

    return token;
  }

  /**
   * 認証が正しく動作するか検証
   */
  private async validateAuthentication(): Promise<void> {
    try {
      // Installation Token が取得できれば認証成功とみなす
      await this.getInstallationToken();
      this.logger.log('✓ GitHub App 認証に成功しました');
      this.logger.log(`✓ App ID: ${this.config.appId}`);
      this.logger.log(`✓ Installation ID: ${this.config.installationId}`);
    } catch (error) {
      this.logger.error('GitHub App 認証に失敗しました', error);
      throw new Error(
        'GitHub App の認証に失敗しました。App ID、Installation ID、秘密鍵を確認してください。\n' +
          'docs/GITHUB_APP_SETUP.md を参照してください。',
      );
    }
  }

  /**
   * GitHub App の設定を取得
   */
  getConfig(): GitHubAppConfig {
    return this.config;
  }
}
