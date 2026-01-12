import { Module } from '@nestjs/common';

// サービス
import { TimeService } from './services/time.service';
import { CalculatorService } from './services/calculator.service';
import { NotesService } from './services/notes.service';

// ツール
import { TimeTool } from './tools/time.tool';
import { CalculatorTool } from './tools/calculator.tool';
import { NotesTool } from './tools/notes.tool';

@Module({
  providers: [
    // サービス層（ビジネスロジック）
    TimeService,
    CalculatorService,
    NotesService,
    // ツール層（MCPインターフェース）
    TimeTool,
    CalculatorTool,
    NotesTool,
  ],
})
export class McpToolsModule {}
