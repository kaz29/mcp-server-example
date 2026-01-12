import { Module } from '@nestjs/common';
import { McpModule, McpTransportType } from '@rekog/mcp-nest';
import { McpToolsModule } from './mcp/mcp.module';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'nestjs-mcp-server',
      version: '1.0.0',
      transport: McpTransportType.STREAMABLE_HTTP,
      mcpEndpoint: '/mcp',
    }),
    McpToolsModule,
  ],
})
export class AppModule {}
