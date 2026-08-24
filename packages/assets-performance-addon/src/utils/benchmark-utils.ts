import type { ReturnData } from '@wealthfolio/addon-sdk';
import type { AssetRiskMetrics, BenchmarkPreset, ComparisonTimeframe, DateRange } from '../types';
import {
  computeDailyReturns,
  computePearsonCorrelation,
  filterSeriesByDateRange,
  toWealthIndex,
  alignSeriesWithForwardFill,
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
  const assetWealth = toWealthIndex(assetSeries);
  const benchmarkWealth = benchmarkSeries ? toWealthIndex(benchmarkSeries) : [];

  // Synchronize Asset, Benchmark, and Portfolio series onto the same continuous market calendar
  const seriesToAlign = [
    { id: 'asset', symbol: 'asset', series: assetSeries },
    ...(benchmarkSeries && benchmarkSeries.length > 0
      ? [{ id: 'benchmark', symbol: 'benchmark', series: benchmarkSeries }]
      : []),
    ...(portfolioSeries && portfolioSeries.length > 0
      ? [{ id: 'portfolio', symbol: 'portfolio', series: portfolioSeries }]
      : []),
  ];

  const alignedReturnsMap = alignSeriesWithForwardFill(seriesToAlign);
  const assetDaily = alignedReturnsMap.get('asset') ?? computeDailyReturns(assetWealth);
  const benchmarkDaily =
    benchmarkSeries && benchmarkSeries.length > 0
      ? (alignedReturnsMap.get('benchmark') ?? null)
      : null;
  const portfolioDaily =
    portfolioSeries && portfolioSeries.length > 0
      ? (alignedReturnsMap.get('portfolio') ?? null)
      : null;

  // 1. Annualized Volatility, CAGR and Sharpe Ratio
  const dailyValues = Array.from(assetDaily.values());
  let volatility: number | null = null;
  let annualizedReturn: number | null = null;
  let sharpeRatio: number | null = null;

  if (dailyValues.length >= 5 && assetWealth.length >= 2) {
    const mean = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length;
    const variance =
      dailyValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (dailyValues.length - 1);
    const dailyStdDev = Math.sqrt(variance);
    volatility = dailyStdDev * Math.sqrt(252); // 252 trading days

    // Geometric Compound Annual Growth Rate (CAGR) from Wealth Index
    const startVal = assetWealth[0].value;
    const endVal = assetWealth[assetWealth.length - 1].value;
    const numDays = Math.max(1, dailyValues.length);

    if (startVal > 0 && endVal > 0) {
      const totalGrowth = endVal / startVal;
      const years = numDays / 252;
      annualizedReturn = years > 0 ? Math.pow(totalGrowth, 1 / years) - 1 : totalGrowth - 1;
    } else {
      annualizedReturn = Math.pow(1 + mean, 252) - 1;
    }

    if (volatility > 0 && annualizedReturn != null) {
      sharpeRatio = (annualizedReturn - riskFreeRate) / volatility;
    }
  }

  // 2. Max Drawdown calculated on continuous Wealth Index (always bounded in [0, 1])
  let maxDrawdown: number | null = null;
  if (assetWealth.length >= 2) {
    let peak = -Infinity;
    let maxDd = 0;

    for (const pt of assetWealth) {
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
    maxDrawdown = Math.min(1.0, Math.max(0.0, maxDd));
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

  if (benchmarkDaily && benchmarkWealth.length >= 2) {
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

          // Benchmark CAGR
          const bmStart = benchmarkWealth[0].value;
          const bmEnd = benchmarkWealth[benchmarkWealth.length - 1].value;
          const bmYears = Math.max(1, benchmarkWealth.length - 1) / 252;
          const benchmarkAnnRet =
            bmStart > 0 && bmEnd > 0
              ? Math.pow(bmEnd / bmStart, 1 / bmYears) - 1
              : Math.pow(1 + meanB, 252) - 1;

          // Jensen's Alpha: R_asset - (Rf + Beta * (R_bm - Rf))
          if (annualizedReturn != null && Number.isFinite(beta)) {
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
  timeframe?: DateRange | ComparisonTimeframe;
  portfolioSeries?: ReturnData[];
  benchmarkSeries?: ReturnData[];
  benchmarkSymbol?: string;
  assetSeriesMap: Map<string, { symbol: string; series: ReturnData[] }>;
}): NormalizedChartPoint[] {
  void benchmarkSymbol;
  // 1. Filter each series by timeframe / dateRange and convert to Wealth Index
  const filteredPortfolio = portfolioSeries
    ? toWealthIndex(filterSeriesByDateRange(portfolioSeries, timeframe))
    : [];
  const filteredBenchmark = benchmarkSeries
    ? toWealthIndex(filterSeriesByDateRange(benchmarkSeries, timeframe))
    : [];

  const filteredAssets = new Map<
    string,
    { symbol: string; series: Array<{ date: string; value: number }> }
  >();
  for (const [key, item] of assetSeriesMap) {
    const fSeries = toWealthIndex(filterSeriesByDateRange(item.series, timeframe));
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
  const toMap = (s: Array<{ date: string; value: number }>) => {
    const m = new Map<string, number>();
    s.forEach((pt) => m.set(pt.date, pt.value));
    return m;
  };

  const portMap = toMap(filteredPortfolio);
  const benchMap = toMap(filteredBenchmark);

  const assetMaps = new Map<string, { symbol: string; map: Map<string, number> }>();
  for (const [key, item] of filteredAssets) {
    assetMaps.set(key, { symbol: item.symbol, map: toMap(item.series) });
  }

  // 3. Find base value (first point) for each series to compute relative % change: (V_t - V_0) / V_0 * 100
  const findBase = (s: Array<{ date: string; value: number }>) =>
    s.length > 0 ? s[0].value : null;

  const portBase = findBase(filteredPortfolio);
  const benchBase = findBase(filteredBenchmark);

  const assetBases = new Map<string, number | null>();
  for (const [key, item] of filteredAssets) {
    assetBases.set(key, findBase(item.series));
  }

  const result: NormalizedChartPoint[] = [];

  for (const date of sortedDates) {
    const point: NormalizedChartPoint = { date };

    // Portfolio normalized return (%)
    if (portBase != null && portMap.has(date) && portBase !== 0) {
      const v = portMap.get(date)!;
      point.portfolio = Number((((v - portBase) / portBase) * 100).toFixed(2));
    }

    // Benchmark normalized return (%)
    if (benchBase != null && benchMap.has(date) && benchBase !== 0) {
      const v = benchMap.get(date)!;
      point.benchmark = Number((((v - benchBase) / benchBase) * 100).toFixed(2));
    }

    // Asset normalized returns (%)
    for (const [key, { symbol, map }] of assetMaps) {
      const base = assetBases.get(key);
      if (base != null && map.has(date) && base !== 0) {
        const v = map.get(date)!;
        point[symbol] = Number((((v - base) / base) * 100).toFixed(2));
      }
    }

    result.push(point);
  }

  return result;
}
