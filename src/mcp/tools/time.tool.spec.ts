import { describe, it, expect, beforeEach } from 'vitest';
import { TimeTool } from './time.tool';
import { TimeService } from '../services/time.service';

describe('TimeTool', () => {
  let tool: TimeTool;
  let timeService: TimeService;

  beforeEach(() => {
    timeService = new TimeService();
    tool = new TimeTool(timeService);
  });

  describe('getCurrentTime', () => {
    it('should return current time with formatted message', async () => {
      const result = await tool.getCurrentTime();

      expect(result).toContain('現在の日時');
      expect(result).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/);
    });

    it('should call TimeService and format the response', async () => {
      const result = await tool.getCurrentTime();

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });
});
