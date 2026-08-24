import type { ReturnData } from '@wealthfolio/addon-sdk';
import type { CorrelationCell, CorrelationMatrixData, ComparisonTimeframe } from '../types';

/**
 * Filters a ReturnData series to match the selected timeframe.
 */
export function filterSeriesByTimeframe(
  series: ReturnData[],
  timeframe: ComparisonTimeframe,
): ReturnData[] {
  if (!series || series.length === 0) return [];
  if (timeframe === 'ALL') return series;

  const now = new Date();
  let startDate: Date;

  switch (timeframe) {
    case '1M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case 'YTD':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case '1Y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case '3Y':
      startDate = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
      break;
    case '5Y':
      startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      break;
    default:
      return series;
  }

  const startIso = startDate.toISOString().split('T')[0];
  return series.filter((pt) => pt.date >= startIso);
}

/**
 * Calculates daily percentage returns from a price/quote series or cumulative return series.
 * returns[t] = (val[t] - val[t-1]) / val[t-1]
 */
export function computeDailyReturns(series: ReturnData[]): Map<string, number> {
  const dailyReturns = new Map<string, number>();
  if (!series || series.length < 2) return dailyReturns;

  // Ensure series is sorted by date ascending
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].value;
    const curr = sorted[i].value;

    if (prev !== 0 && Number.isFinite(prev) && Number.isFinite(curr)) {
      const ret = (curr - prev) / Math.abs(prev);
      dailyReturns.set(sorted[i].date, ret);
    }
  }

  return dailyReturns;
}

/**
 * Calculates the Pearson correlation coefficient between two series of daily returns.
 */
export function computePearsonCorrelation(
  returnsA: Map<string, number>,
  returnsB: Map<string, number>,
): { correlation: number; commonPoints: number } {
  const commonDates: string[] = [];

  for (const [date] of returnsA) {
    if (returnsB.has(date)) {
      commonDates.push(date);
    }
  }

  if (commonDates.length < 3) {
    return { correlation: 0, commonPoints: commonDates.length };
  }

  const valsA = commonDates.map((d) => returnsA.get(d)!);
  const valsB = commonDates.map((d) => returnsB.get(d)!);

  const n = commonDates.length;
  const meanA = valsA.reduce((sum, v) => sum + v, 0) / n;
  const meanB = valsB.reduce((sum, v) => sum + v, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = valsA[i] - meanA;
    const diffB = valsB[i] - meanB;
    num += diffA * diffB;
    denA += diffA * diffA;
    denB += diffB * diffB;
  }

  if (denA === 0 || denB === 0) {
    return { correlation: 0, commonPoints: n };
  }

  const correlation = num / Math.sqrt(denA * denB);
  const clamped = Math.max(-1, Math.min(1, correlation));

  return {
    correlation: Number.isFinite(clamped) ? clamped : 0,
    commonPoints: n,
  };
}

/**
 * Generates an N x N correlation matrix across multiple asset return series.
 */
export function buildCorrelationMatrix(
  assets: Array<{ id: string; symbol: string; name: string; series: ReturnData[] }>,
  timeframe: ComparisonTimeframe = '1Y',
): CorrelationMatrixData {
  const filteredAssets = assets.map((a) => ({
    ...a,
    dailyReturns: computeDailyReturns(filterSeriesByTimeframe(a.series, timeframe)),
  }));

  const symbols = filteredAssets.map((a) => a.symbol);
  const names: Record<string, string> = {};
  filteredAssets.forEach((a) => {
    names[a.symbol] = a.name;
  });

  const n = filteredAssets.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
  const pairs: CorrelationCell[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j > i) {
        const { correlation, commonPoints } = computePearsonCorrelation(
          filteredAssets[i].dailyReturns,
          filteredAssets[j].dailyReturns,
        );

        matrix[i][j] = correlation;
        matrix[j][i] = correlation;

        pairs.push({
          assetAId: filteredAssets[i].id,
          assetASymbol: filteredAssets[i].symbol,
          assetBId: filteredAssets[j].id,
          assetBSymbol: filteredAssets[j].symbol,
          correlation,
          commonPoints,
        });
      }
    }
  }

  return {
    symbols,
    names,
    matrix,
    pairs,
  };
}
