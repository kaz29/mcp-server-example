import { Module } from '@nestjs/common';

// サービス
import { TimeService } from './services/time.service';
import { CalculatorService } from './services/calculator.service';
import { NotesService } from './services/notes.service';
import { GitHubAuthService } from './services/github/github-auth.service';
import { GitHubApiService } from './services/github/github-api.service';
import { DeploymentFrequencyService } from './services/four-keys/deployment-frequency.service';

// ツール
import { TimeTool } from './tools/time.tool';
import { CalculatorTool } from './tools/calculator.tool';
import { NotesTool } from './tools/notes.tool';
import { DeploymentFrequencyTool } from './tools/four-keys/deployment-frequency.tool';

@Module({
  providers: [
    // サービス層（ビジネスロジック）
    TimeService,
    CalculatorService,
    NotesService,
    // GitHub サービス
    GitHubAuthService,
    GitHubApiService,
    // Four Keys サービス
    DeploymentFrequencyService,
    // ツール層（MCPインターフェース）
    TimeTool,
    CalculatorTool,
    NotesTool,
    // Four Keys ツール
    DeploymentFrequencyTool,
  ],
})
export class McpToolsModule {}
