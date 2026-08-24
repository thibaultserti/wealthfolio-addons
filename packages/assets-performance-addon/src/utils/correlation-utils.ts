import type { ReturnData } from '@wealthfolio/addon-sdk';
import type {
  CorrelationCell,
  CorrelationMatrixData,
  ComparisonTimeframe,
  DateRange,
} from '../types';

/**
 * Converts a raw series (which could be absolute prices, % return series, or decimal cumulative return series)
 * into a continuous normalized Wealth/Price index series V_t > 0.
 */
export function toWealthIndex(series: ReturnData[]): Array<{ date: string; value: number }> {
  if (!series || series.length === 0) return [];
  const sorted = [...series]
    .filter((p) => Number.isFinite(p.value) && Boolean(p.date))
    .map((p) => ({
      date: (typeof p.date === 'string' ? p.date : new Date(p.date).toISOString()).split('T')[0],
      value: p.value,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];

  // Determine if series values are absolute prices (e.g. all > 0, typical stock price > 1.0)
  // or decimal / percentage cumulative returns (e.g. starting near 0)
  const firstVal = sorted[0].value;
  const allPositive = sorted.every((p) => p.value > 0);
  const isAbsolutePrice =
    allPositive && Math.abs(firstVal) >= 1.0 && !sorted.some((p) => p.value === 0);

  if (isAbsolutePrice) {
    return sorted.map((p) => ({ date: p.date, value: p.value }));
  }

  // It's a cumulative return series (e.g. 0, 0.05, -0.02, 0.12 or 0%, 5%, -2%)
  const maxAbs = Math.max(...sorted.map((p) => Math.abs(p.value)));
  const isPercentage = maxAbs > 5.0 && sorted.some((p) => Math.abs(p.value) > 2.0);

  return sorted.map((p) => {
    const decimalReturn = isPercentage ? p.value / 100 : p.value;
    const wealth = Math.max(0.0001, 1 + decimalReturn);
    return { date: p.date, value: wealth * 100 };
  });
}

/**
 * Filters a ReturnData series to match the selected DateRange or timeframe.
 */
export function filterSeriesByDateRange(
  series: ReturnData[],
  range?: DateRange | ComparisonTimeframe,
): ReturnData[] {
  if (!series || series.length === 0) return [];
  if (!range) return series;

  if (typeof range === 'string') {
    return filterSeriesByTimeframe(series, range);
  }

  const { from, to } = range;
  const fromIso = from ? from.toISOString().split('T')[0] : undefined;
  const toIso = to ? to.toISOString().split('T')[0] : undefined;

  return series.filter((pt) => {
    if (fromIso && pt.date < fromIso) return false;
    if (toIso && pt.date > toIso) return false;
    return true;
  });
}

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
 * Calculates daily percentage returns from a price or wealth series.
 * returns[t] = (val[t] - val[t-1]) / val[t-1]
 */
export function computeDailyReturns(
  series: Array<{ date: string; value: number }> | ReturnData[],
): Map<string, number> {
  const dailyReturns = new Map<string, number>();
  if (!series || series.length < 2) return dailyReturns;

  const wealthSeries = toWealthIndex(series);
  if (wealthSeries.length < 2) return dailyReturns;

  for (let i = 1; i < wealthSeries.length; i++) {
    const prev = wealthSeries[i - 1].value;
    const curr = wealthSeries[i].value;

    if (prev > 0 && Number.isFinite(curr)) {
      const ret = (curr - prev) / prev;
      dailyReturns.set(wealthSeries[i].date, ret);
    }
  }

  return dailyReturns;
}

/**
 * Aligns multiple asset price series onto a unified calendar of market dates with forward-fill,
 * eliminating missing day gaps (e.g. US vs European bank holidays) and avoiding "holes" in correlations.
 */
export function alignSeriesWithForwardFill(
  assetSeries: Array<{ id: string; symbol: string; series: ReturnData[] }>,
): Map<string, Map<string, number>> {
  // 1. Convert all series to wealth index and gather all unique sorted dates
  const wealthAssetSeries = assetSeries.map((a) => ({
    ...a,
    wealthSeries: toWealthIndex(a.series),
  }));

  const allDatesSet = new Set<string>();
  for (const asset of wealthAssetSeries) {
    for (const pt of asset.wealthSeries) {
      if (pt.date && Number.isFinite(pt.value)) {
        allDatesSet.add(pt.date);
      }
    }
  }

  const sortedDates = Array.from(allDatesSet).sort();
  const alignedDailyReturns = new Map<string, Map<string, number>>();

  for (const asset of wealthAssetSeries) {
    const assetReturns = new Map<string, number>();
    if (!asset.wealthSeries || asset.wealthSeries.length < 2) {
      alignedDailyReturns.set(asset.symbol, assetReturns);
      continue;
    }

    // Map existing dates -> value
    const priceMap = new Map<string, number>();
    for (const pt of asset.wealthSeries) {
      if (Number.isFinite(pt.value)) {
        priceMap.set(pt.date, pt.value);
      }
    }

    // Find the first date this asset has data
    let hasStarted = false;
    let lastPrice = 0;
    const alignedPrices: Array<{ date: string; price: number }> = [];

    for (const date of sortedDates) {
      if (priceMap.has(date)) {
        hasStarted = true;
        lastPrice = priceMap.get(date)!;
        alignedPrices.push({ date, price: lastPrice });
      } else if (hasStarted) {
        // Forward fill previous close price
        alignedPrices.push({ date, price: lastPrice });
      }
    }

    // Compute daily returns from forward-filled prices
    for (let i = 1; i < alignedPrices.length; i++) {
      const prev = alignedPrices[i - 1].price;
      const curr = alignedPrices[i].price;
      if (prev > 0 && Number.isFinite(curr)) {
        assetReturns.set(alignedPrices[i].date, (curr - prev) / prev);
      }
    }

    alignedDailyReturns.set(asset.symbol, assetReturns);
  }

  return alignedDailyReturns;
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
  timeframe: DateRange | ComparisonTimeframe = '1Y',
): CorrelationMatrixData {
  // 1. Filter series by timeframe/dateRange
  const filteredAssets = assets
    .filter((a) => a.series && a.series.length > 0)
    .map((a) => ({
      ...a,
      filteredSeries: filterSeriesByDateRange(a.series, timeframe),
    }))
    .filter((a) => a.filteredSeries.length > 0);

  // If no assets have enough series, fallback to input assets list
  const activeAssets = filteredAssets.length > 0 ? filteredAssets : assets;

  // 2. Synchronize price calendars with forward-fill
  const alignedDailyReturns = alignSeriesWithForwardFill(
    activeAssets.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      series:
        'filteredSeries' in a
          ? (a as unknown as { filteredSeries: ReturnData[] }).filteredSeries
          : a.series,
    })),
  );

  const symbols = activeAssets.map((a) => a.symbol);
  const names: Record<string, string> = {};
  activeAssets.forEach((a) => {
    names[a.symbol] = a.name;
  });

  const n = activeAssets.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
  const pairs: CorrelationCell[] = [];

  for (let i = 0; i < n; i++) {
    const symA = symbols[i];
    const returnsA = alignedDailyReturns.get(symA) ?? new Map<string, number>();

    for (let j = 0; j < n; j++) {
      const symB = symbols[j];
      const returnsB = alignedDailyReturns.get(symB) ?? new Map<string, number>();

      if (i === j) {
        matrix[i][j] = 1;
      } else if (j > i) {
        const { correlation, commonPoints } = computePearsonCorrelation(returnsA, returnsB);

        matrix[i][j] = correlation;
        matrix[j][i] = correlation;

        pairs.push({
          assetAId: activeAssets[i].id,
          assetASymbol: symA,
          assetBId: activeAssets[j].id,
          assetBSymbol: symB,
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
