import { Injectable } from '@nestjs/common';

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide';

export interface CalculationResult {
  operation: string;
  operationName: string;
  a: number;
  b: number;
  result: number;
  symbol: string;
}

@Injectable()
export class CalculatorService {
  /**
   * 四則演算を実行
   */
  calculate(operation: Operation, a: number, b: number): CalculationResult {
    let result: number;
    let operationName: string;
    let symbol: string;

    switch (operation) {
      case 'add':
        result = a + b;
        operationName = '加算';
        symbol = '+';
        break;
      case 'subtract':
        result = a - b;
        operationName = '減算';
        symbol = '-';
        break;
      case 'multiply':
        result = a * b;
        operationName = '乗算';
        symbol = '×';
        break;
      case 'divide':
        if (b === 0) {
          throw new Error('0で割ることはできません');
        }
        result = a / b;
        operationName = '除算';
        symbol = '÷';
        break;
      default:
        throw new Error(`未知の演算: ${operation}`);
    }

    return {
      operation,
      operationName,
      a,
      b,
      result,
      symbol,
    };
  }
}
