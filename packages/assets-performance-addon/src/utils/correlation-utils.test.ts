import { describe, it, expect } from 'vitest';
import {
  computeDailyReturns,
  computePearsonCorrelation,
  buildCorrelationMatrix,
} from './correlation-utils';
import type { ReturnData } from '@wealthfolio/addon-sdk';

describe('correlation-utils', () => {
  it('computes daily percentage returns accurately', () => {
    const series: ReturnData[] = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 110 }, // +10%
      { date: '2024-01-03', value: 99 }, // -10%
    ];

    const daily = computeDailyReturns(series);
    expect(daily.get('2024-01-02')).toBeCloseTo(0.1, 4);
    expect(daily.get('2024-01-03')).toBeCloseTo(-0.1, 4);
  });

  it('computes perfect correlation (+1.0) for identical series', () => {
    const returnsA = new Map([
      ['2024-01-01', 0.01],
      ['2024-01-02', -0.02],
      ['2024-01-03', 0.015],
      ['2024-01-04', 0.005],
    ]);

    const { correlation, commonPoints } = computePearsonCorrelation(returnsA, returnsA);
    expect(commonPoints).toBe(4);
    expect(correlation).toBeCloseTo(1.0, 4);
  });

  it('computes inverse correlation (-1.0) for opposite movements', () => {
    const returnsA = new Map([
      ['2024-01-01', 0.01],
      ['2024-01-02', -0.02],
      ['2024-01-03', 0.015],
      ['2024-01-04', -0.005],
    ]);

    const returnsB = new Map([
      ['2024-01-01', -0.01],
      ['2024-01-02', 0.02],
      ['2024-01-03', -0.015],
      ['2024-01-04', 0.005],
    ]);

    const { correlation } = computePearsonCorrelation(returnsA, returnsB);
    expect(correlation).toBeCloseTo(-1.0, 4);
  });

  it('builds a complete N x N correlation matrix', () => {
    const asset1: ReturnData[] = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 105 },
      { date: '2024-01-03', value: 102 },
      { date: '2024-01-04', value: 108 },
    ];
    const asset2: ReturnData[] = [
      { date: '2024-01-01', value: 50 },
      { date: '2024-01-02', value: 52.5 },
      { date: '2024-01-03', value: 51 },
      { date: '2024-01-04', value: 54 },
    ];

    const matrixData = buildCorrelationMatrix(
      [
        { id: '1', symbol: 'AAPL', name: 'Apple', series: asset1 },
        { id: '2', symbol: 'MSFT', name: 'Microsoft', series: asset2 },
      ],
      'ALL',
    );

    expect(matrixData.symbols).toEqual(['AAPL', 'MSFT']);
    expect(matrixData.matrix[0][0]).toBe(1);
    expect(matrixData.matrix[1][1]).toBe(1);
    expect(matrixData.matrix[0][1]).toBeCloseTo(1.0, 2);
    expect(matrixData.matrix[1][0]).toBeCloseTo(1.0, 2);
  });
});
