import { describe, it, expect } from 'vitest';
import { calculateAssetRiskMetrics, buildNormalizedComparisonSeries } from './benchmark-utils';
import type { ReturnData } from '@wealthfolio/addon-sdk';

describe('benchmark-utils', () => {
  it('calculates risk metrics (volatility, beta, alpha) against benchmark', () => {
    const assetSeries: ReturnData[] = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 102 },
      { date: '2024-01-03', value: 101 },
      { date: '2024-01-04', value: 104 },
      { date: '2024-01-05', value: 103 },
      { date: '2024-01-06', value: 106 },
    ];

    const benchmarkSeries: ReturnData[] = [
      { date: '2024-01-01', value: 1000 },
      { date: '2024-01-02', value: 1010 },
      { date: '2024-01-03', value: 1005 },
      { date: '2024-01-04', value: 1020 },
      { date: '2024-01-05', value: 1015 },
      { date: '2024-01-06', value: 1030 },
    ];

    const metrics = calculateAssetRiskMetrics({
      assetSeries,
      benchmarkSeries,
    });

    expect(metrics.volatility).not.toBeNull();
    expect(metrics.beta).not.toBeNull();
    // Asset moves roughly 2x the benchmark return -> beta ≈ 2
    expect(metrics.beta!).toBeCloseTo(2.0, 1);
    expect(metrics.correlationBenchmark).toBeCloseTo(1.0, 2);
  });

  it('handles cumulative decimal return series without explosive volatility or drawdown', () => {
    const assetSeries: ReturnData[] = [
      { date: '2024-01-01', value: 0.0 },
      { date: '2024-01-02', value: 0.01 },
      { date: '2024-01-03', value: -0.02 },
      { date: '2024-01-04', value: 0.03 },
      { date: '2024-01-05', value: 0.02 },
      { date: '2024-01-06', value: 0.05 },
    ];

    const metrics = calculateAssetRiskMetrics({
      assetSeries,
    });

    expect(metrics.volatility).not.toBeNull();
    expect(metrics.volatility!).toBeLessThan(1.5); // Reasonably bounded annualized volatility (< 150%)
    expect(metrics.maxDrawdown).not.toBeNull();
    expect(metrics.maxDrawdown!).toBeGreaterThanOrEqual(0);
    expect(metrics.maxDrawdown!).toBeLessThanOrEqual(1.0); // Never > 100%
  });

  it('normalizes and rebases multi-asset series to start at 0%', () => {
    const portfolioSeries: ReturnData[] = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 105 },
      { date: '2024-01-03', value: 110 },
    ];

    const assetMap = new Map([
      [
        'AAPL',
        {
          symbol: 'AAPL',
          series: [
            { date: '2024-01-01', value: 150 },
            { date: '2024-01-02', value: 165 }, // +10%
            { date: '2024-01-03', value: 180 }, // +20%
          ],
        },
      ],
    ]);

    const chartPoints = buildNormalizedComparisonSeries({
      timeframe: 'ALL',
      portfolioSeries,
      assetSeriesMap: assetMap,
    });

    expect(chartPoints.length).toBe(3);
    // On first date, baseline should be 0.00%
    expect(chartPoints[0].portfolio).toBe(0);
    expect(chartPoints[0].AAPL).toBe(0);

    // On second date:
    expect(chartPoints[1].portfolio).toBeCloseTo(5.0, 1);
    expect(chartPoints[1].AAPL).toBeCloseTo(10.0, 1);
  });
});
