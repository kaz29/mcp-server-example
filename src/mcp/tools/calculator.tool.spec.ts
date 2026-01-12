import { describe, it, expect, beforeEach } from 'vitest';
import { CalculatorTool } from './calculator.tool';
import { CalculatorService } from '../services/calculator.service';

describe('CalculatorTool', () => {
  let tool: CalculatorTool;
  let calculatorService: CalculatorService;

  beforeEach(() => {
    calculatorService = new CalculatorService();
    tool = new CalculatorTool(calculatorService);
  });

  describe('calculate', () => {
    it('should perform addition and return formatted result', async () => {
      const result = await tool.calculate({ operation: 'add', a: 10, b: 5 });

      expect(result).toBe('加算: 10 + 5 = 15');
    });

    it('should perform subtraction', async () => {
      const result = await tool.calculate({ operation: 'subtract', a: 10, b: 5 });

      expect(result).toBe('減算: 10 - 5 = 5');
    });

    it('should perform multiplication', async () => {
      const result = await tool.calculate({ operation: 'multiply', a: 10, b: 5 });

      expect(result).toBe('乗算: 10 × 5 = 50');
    });

    it('should perform division', async () => {
      const result = await tool.calculate({ operation: 'divide', a: 10, b: 5 });

      expect(result).toBe('除算: 10 ÷ 5 = 2');
    });

    it('should handle decimal results', async () => {
      const result = await tool.calculate({ operation: 'divide', a: 10, b: 3 });

      expect(result).toContain('3.333');
    });
  });
});
