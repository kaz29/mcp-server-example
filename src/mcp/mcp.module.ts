import { Module } from '@nestjs/common';

// サービス
import { TimeService } from './services/time.service';
import { CalculatorService } from './services/calculator.service';
import { NotesService } from './services/notes.service';
import { GitHubAuthService } from './services/github/github-auth.service';
import { GitHubApiService } from './services/github/github-api.service';
import { DeploymentFrequencyService } from './services/four-keys/deployment-frequency.service';
import { LeadTimeService } from './services/four-keys/lead-time.service';
import { ChangeFailureRateService } from './services/four-keys/change-failure-rate.service';
import { MTTRService } from './services/four-keys/mttr.service';

// ツール
import { TimeTool } from './tools/time.tool';
import { CalculatorTool } from './tools/calculator.tool';
import { NotesTool } from './tools/notes.tool';
import { DeploymentFrequencyTool } from './tools/four-keys/deployment-frequency.tool';
import { LeadTimeTool } from './tools/four-keys/lead-time.tool';
import { ChangeFailureRateTool } from './tools/four-keys/change-failure-rate.tool';
import { MTTRTool } from './tools/four-keys/mttr.tool';
import { FourKeysSummaryTool } from './tools/four-keys/summary.tool';

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
    LeadTimeService,
    ChangeFailureRateService,
    MTTRService,
    // ツール層（MCPインターフェース）
    TimeTool,
    CalculatorTool,
    NotesTool,
    // Four Keys ツール
    DeploymentFrequencyTool,
    LeadTimeTool,
    ChangeFailureRateTool,
    MTTRTool,
    FourKeysSummaryTool,
  ],
})
export class McpToolsModule {}
