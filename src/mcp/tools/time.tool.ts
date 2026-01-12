import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { TimeService } from '../services/time.service';

@Injectable()
export class TimeTool {
  constructor(private readonly timeService: TimeService) {}

  @Tool({
    name: 'get_current_time',
    description: '現在の日時を取得します',
    parameters: z.object({}),
  })
  async getCurrentTime() {
    const time = this.timeService.getCurrentTime();
    return `現在の日時: ${time}`;
  }
}
