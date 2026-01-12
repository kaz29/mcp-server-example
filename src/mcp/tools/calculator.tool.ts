import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { CalculatorService, Operation } from '../services/calculator.service';

@Injectable()
export class CalculatorTool {
  constructor(private readonly calculatorService: CalculatorService) {}

  @Tool({
    name: 'calculate',
    description: '簡単な計算を実行します（加算、減算、乗算、除算）',
    parameters: z.object({
      operation: z
        .enum(['add', 'subtract', 'multiply', 'divide'])
        .describe('実行する演算（add: 加算, subtract: 減算, multiply: 乗算, divide: 除算）'),
      a: z.number().describe('最初の数値'),
      b: z.number().describe('2番目の数値'),
    }),
  })
  async calculate({ operation, a, b }: { operation: Operation; a: number; b: number }) {
    const result = this.calculatorService.calculate(operation, a, b);
    return `${result.operationName}: ${result.a} ${result.symbol} ${result.b} = ${result.result}`;
  }
}
