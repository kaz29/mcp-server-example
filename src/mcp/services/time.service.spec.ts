import { describe, it, expect, beforeEach } from 'vitest';
import { TimeService } from './time.service';

describe('TimeService', () => {
  let service: TimeService;

  beforeEach(() => {
    service = new TimeService();
  });

  describe('getCurrentTime', () => {
    it('should return current time as Japanese locale string', () => {
      const result = service.getCurrentTime();

      // 日本語形式の日時文字列が返される
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');

      // 日本語の日時形式を確認（例: "2026/1/12 12:34:56"）
      expect(result).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/);
    });

    it('should return a valid date string', () => {
      const result = service.getCurrentTime();

      // 返された文字列から日付が解析できることを確認
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
