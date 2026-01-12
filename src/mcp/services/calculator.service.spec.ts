import { describe, it, expect, beforeEach } from 'vitest';
import { CalculatorService } from './calculator.service';

describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(() => {
    service = new CalculatorService();
  });

  describe('calculate', () => {
    describe('add operation', () => {
      it('should add two positive numbers', () => {
        const result = service.calculate('add', 10, 5);

        expect(result).toEqual({
          operation: 'add',
          operationName: '加算',
          a: 10,
          b: 5,
          result: 15,
          symbol: '+',
        });
      });

      it('should add negative numbers', () => {
        const result = service.calculate('add', -10, -5);

        expect(result.result).toBe(-15);
        expect(result.operation).toBe('add');
      });
    });

    describe('subtract operation', () => {
      it('should subtract two numbers', () => {
        const result = service.calculate('subtract', 10, 5);

        expect(result).toEqual({
          operation: 'subtract',
          operationName: '減算',
          a: 10,
          b: 5,
          result: 5,
          symbol: '-',
        });
      });

      it('should handle negative results', () => {
        const result = service.calculate('subtract', 5, 10);

        expect(result.result).toBe(-5);
      });
    });

    describe('multiply operation', () => {
      it('should multiply two numbers', () => {
        const result = service.calculate('multiply', 10, 5);

        expect(result).toEqual({
          operation: 'multiply',
          operationName: '乗算',
          a: 10,
          b: 5,
          result: 50,
          symbol: '×',
        });
      });

      it('should handle multiplication by zero', () => {
        const result = service.calculate('multiply', 10, 0);

        expect(result.result).toBe(0);
      });
    });

    describe('divide operation', () => {
      it('should divide two numbers', () => {
        const result = service.calculate('divide', 10, 5);

        expect(result).toEqual({
          operation: 'divide',
          operationName: '除算',
          a: 10,
          b: 5,
          result: 2,
          symbol: '÷',
        });
      });

      it('should handle decimal results', () => {
        const result = service.calculate('divide', 10, 3);

        expect(result.result).toBeCloseTo(3.333, 3);
      });

      it('should throw error when dividing by zero', () => {
        expect(() => {
          service.calculate('divide', 10, 0);
        }).toThrow('0で割ることはできません');
      });
    });

    describe('invalid operation', () => {
      it('should throw error for unknown operation', () => {
        expect(() => {
          service.calculate('invalid' as any, 10, 5);
        }).toThrow('未知の演算');
      });
    });
  });
});
