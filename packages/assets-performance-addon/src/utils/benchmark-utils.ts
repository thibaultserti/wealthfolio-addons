import type { ReturnData } from '@wealthfolio/addon-sdk';
import type { AssetRiskMetrics, BenchmarkPreset, ComparisonTimeframe } from '../types';
import {
  computeDailyReturns,
  computePearsonCorrelation,
  filterSeriesByTimeframe,
} from './correlation-utils';

export const BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    id: 'sp500',
    symbol: '^GSPC',
    name: 'S&P 500',
    description: 'US Large-Cap Equity Index',
  },
  {
    id: 'nasdaq100',
    symbol: '^IXIC',
    name: 'Nasdaq 100',
    description: 'US Tech / Growth Index',
  },
  {
    id: 'msci-world',
    symbol: 'URTH',
    name: 'MSCI World (URTH)',
    description: 'Global Developed Markets ETF',
  },
  {
    id: 'total-us',
    symbol: 'VTI',
    name: 'Total US Market (VTI)',
    description: 'Vanguard Total Stock Market ETF',
  },
  {
    id: 'all-world',
    symbol: 'VWCE.DE',
    name: 'Vanguard FTSE All-World (VWCE)',
    description: 'Global All-Cap All-World ETF',
  },
  {
    id: 'btc',
    symbol: 'BTC-USD',
    name: 'Bitcoin (BTC-USD)',
    description: 'Cryptocurrency Benchmark',
  },
];

/**
 * Calculates statistical risk & comparative metrics for an asset against a benchmark and portfolio.
 */
export function calculateAssetRiskMetrics({
  assetSeries,
  benchmarkSeries,
  portfolioSeries,
  riskFreeRate = 0.02,
}: {
  assetSeries: ReturnData[];
  benchmarkSeries?: ReturnData[];
  portfolioSeries?: ReturnData[];
  riskFreeRate?: number;
}): AssetRiskMetrics {
  const assetDaily = computeDailyReturns(assetSeries);
  const benchmarkDaily = benchmarkSeries ? computeDailyReturns(benchmarkSeries) : null;
  const portfolioDaily = portfolioSeries ? computeDailyReturns(portfolioSeries) : null;

  // 1. Annualized Volatility
  const dailyValues = Array.from(assetDaily.values());
  let volatility: number | null = null;
  let annualizedReturn: number | null = null;
  let sharpeRatio: number | null = null;

  if (dailyValues.length >= 5) {
    const mean = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length;
    const variance =
      dailyValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (dailyValues.length - 1);
    const dailyStdDev = Math.sqrt(variance);
    volatility = dailyStdDev * Math.sqrt(252); // 252 trading days

    annualizedReturn = Math.pow(1 + mean, 252) - 1;
    if (volatility > 0) {
      sharpeRatio = (annualizedReturn - riskFreeRate) / volatility;
    }
  }

  // 2. Max Drawdown
  let maxDrawdown: number | null = null;
  if (assetSeries.length >= 2) {
    let peak = -Infinity;
    let maxDd = 0;

    for (const pt of assetSeries) {
      if (pt.value > peak) {
        peak = pt.value;
      }
      if (peak > 0) {
        const dd = (peak - pt.value) / peak;
        if (dd > maxDd) {
          maxDd = dd;
        }
      }
    }
    maxDrawdown = maxDd;
  }

  // 3. Correlation with Portfolio
  let correlationPortfolio: number | null = null;
  if (portfolioDaily) {
    const res = computePearsonCorrelation(assetDaily, portfolioDaily);
    if (res.commonPoints >= 5) {
      correlationPortfolio = res.correlation;
    }
  }

  // 4. Benchmark Metrics (Alpha, Beta, Correlation)
  let alpha: number | null = null;
  let beta: number | null = null;
  let correlationBenchmark: number | null = null;

  if (benchmarkDaily) {
    const res = computePearsonCorrelation(assetDaily, benchmarkDaily);
    if (res.commonPoints >= 5) {
      correlationBenchmark = res.correlation;

      // Find common dates for Beta calculation
      const commonDates: string[] = [];
      for (const [d] of assetDaily) {
        if (benchmarkDaily.has(d)) commonDates.push(d);
      }

      if (commonDates.length >= 5) {
        const aVals = commonDates.map((d) => assetDaily.get(d)!);
        const bVals = commonDates.map((d) => benchmarkDaily.get(d)!);

        const meanA = aVals.reduce((s, v) => s + v, 0) / aVals.length;
        const meanB = bVals.reduce((s, v) => s + v, 0) / bVals.length;

        let cov = 0;
        let varB = 0;
        for (let i = 0; i < commonDates.length; i++) {
          cov += (aVals[i] - meanA) * (bVals[i] - meanB);
          varB += Math.pow(bVals[i] - meanB, 2);
        }

        if (varB > 0) {
          beta = cov / varB;

          // Annualized alpha: R_asset - (Rf + Beta * (R_bm - Rf))
          const benchmarkAnnRet = Math.pow(1 + meanB, 252) - 1;
          if (annualizedReturn != null) {
            alpha = annualizedReturn - (riskFreeRate + beta * (benchmarkAnnRet - riskFreeRate));
          }
        }
      }
    }
  }

  return {
    alpha,
    beta,
    correlationBenchmark,
    correlationPortfolio,
    volatility,
    sharpeRatio,
    maxDrawdown,
  };
}

export interface NormalizedChartPoint {
  date: string;
  [key: string]: number | string; // dynamic line keys: e.g. "portfolio", "benchmark", "AAPL", "MSFT"
}

/**
 * Re-bases multiple time series to start at 0% on the first common or available date in the selected timeframe.
 */
export function buildNormalizedComparisonSeries({
  timeframe,
  portfolioSeries,
  benchmarkSeries,
  benchmarkSymbol,
  assetSeriesMap,
}: {
  timeframe: ComparisonTimeframe;
  portfolioSeries?: ReturnData[];
  benchmarkSeries?: ReturnData[];
  benchmarkSymbol?: string;
  assetSeriesMap: Map<string, { symbol: string; series: ReturnData[] }>;
}): NormalizedChartPoint[] {
  // 1. Filter each series by timeframe
  const filteredPortfolio = portfolioSeries
    ? filterSeriesByTimeframe(portfolioSeries, timeframe)
    : [];
  const filteredBenchmark = benchmarkSeries
    ? filterSeriesByTimeframe(benchmarkSeries, timeframe)
    : [];

  const filteredAssets = new Map<string, { symbol: string; series: ReturnData[] }>();
  for (const [key, item] of assetSeriesMap) {
    const fSeries = filterSeriesByTimeframe(item.series, timeframe);
    if (fSeries.length > 0) {
      filteredAssets.set(key, { symbol: item.symbol, series: fSeries });
    }
  }

  // 2. Collect all unique dates and sort
  const allDatesSet = new Set<string>();
  filteredPortfolio.forEach((p) => allDatesSet.add(p.date));
  filteredBenchmark.forEach((p) => allDatesSet.add(p.date));
  filteredAssets.forEach((item) => item.series.forEach((p) => allDatesSet.add(p.date)));

  const sortedDates = Array.from(allDatesSet).sort();
  if (sortedDates.length === 0) return [];

  // Helper map from date -> value
  const toMap = (s: ReturnData[]) => {
    const m = new Map<string, number>();
    s.forEach((pt) => m.set(pt.date, pt.value));
    return m;
  };

  const portMap = toMap(filteredPortfolio);
  const bmMap = toMap(filteredBenchmark);
  const assetMaps = new Map<string, Map<string, number>>();
  filteredAssets.forEach((item, key) => assetMaps.set(key, toMap(item.series)));

  // Find baseline (initial value) for each series
  const findBaseline = (m: Map<string, number>) => {
    for (const d of sortedDates) {
      if (m.has(d) && Number.isFinite(m.get(d)!)) {
        return m.get(d)!;
      }
    }
    return null;
  };

  const portBase = findBaseline(portMap);
  const bmBase = findBaseline(bmMap);
  const assetBases = new Map<string, number | null>();
  assetMaps.forEach((m, key) => assetBases.set(key, findBaseline(m)));

  const chartData: NormalizedChartPoint[] = [];

  let lastPortVal = 0;
  let lastBmVal = 0;
  const lastAssetVals = new Map<string, number>();

  for (const date of sortedDates) {
    const point: NormalizedChartPoint = { date };

    // Helper to calculate rebased % change relative to baseline
    const calcRebased = (curr: number, base: number) => {
      if (Math.abs(base) > 1.0) {
        // Absolute prices / indices (e.g. 150 -> 165)
        return ((curr - base) / Math.abs(base)) * 100;
      }
      // Rate / decimal series (e.g. 0.05 -> 0.10)
      return base >= -0.99 ? ((1 + curr) / (1 + base) - 1) * 100 : (curr - base) * 100;
    };

    // Portfolio
    if (portBase != null) {
      if (portMap.has(date)) {
        lastPortVal = calcRebased(portMap.get(date)!, portBase);
      }
      point['portfolio'] = Number(lastPortVal.toFixed(2));
    }

    // Benchmark
    if (bmBase != null && benchmarkSymbol) {
      if (bmMap.has(date)) {
        lastBmVal = calcRebased(bmMap.get(date)!, bmBase);
      }
      point['benchmark'] = Number(lastBmVal.toFixed(2));
    }

    // Assets
    for (const [key, item] of filteredAssets) {
      const base = assetBases.get(key);
      const aMap = assetMaps.get(key)!;
      if (base != null) {
        if (aMap.has(date)) {
          lastAssetVals.set(key, calcRebased(aMap.get(date)!, base));
        }
        const val = lastAssetVals.get(key) ?? 0;
        point[item.symbol] = Number(val.toFixed(2));
      }
    }

    chartData.push(point);
  }

  return chartData;
}
