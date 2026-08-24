import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  HostAPI,
  Account,
  Holding,
  ActivityDetails,
  PerformanceResult,
  ReturnData,
} from '@wealthfolio/addon-sdk';
import type {
  PortfolioScope,
  AssetPerformanceItem,
  DatedCashFlow,
  CorrelationMatrixData,
  ComparisonTimeframe,
  DateRange,
} from '../types';
import { computeHoldingPerformance } from '../utils/irr-twr-utils';
import { buildCorrelationMatrix, filterSeriesByDateRange } from '../utils/correlation-utils';
import { calculateAssetRiskMetrics } from '../utils/benchmark-utils';

interface UseAssetsPerformanceOptions {
  api: HostAPI;
  scope: PortfolioScope;
  benchmarkSymbol: string;
  dateRange?: DateRange;
  correlationTimeframe?: DateRange | ComparisonTimeframe;
}

export interface AssetsPerformanceData {
  assets: AssetPerformanceItem[];
  correlationMatrix: CorrelationMatrixData;
  portfolioSeries: ReturnData[];
  benchmarkSeries: ReturnData[];
  portfolioName: string;
  benchmarkName: string;
  baseCurrency: string;
  totalPortfolioValue: number;
}

export function useAssetsPerformance({
  api,
  scope,
  benchmarkSymbol,
  dateRange,
  correlationTimeframe,
}: UseAssetsPerformanceOptions) {
  // Query 1: Settings & Base Currency
  const settingsQuery = useQuery({
    queryKey: ['addon-settings'],
    queryFn: async () => {
      try {
        return await api.settings.get();
      } catch {
        return { baseCurrency: 'USD' };
      }
    },
    staleTime: 300_000,
  });

  // Query 2: Accounts
  const accountsQuery = useQuery({
    queryKey: ['accounts-list'],
    queryFn: async () => {
      try {
        return await api.accounts.getAll();
      } catch {
        return [] as Account[];
      }
    },
    staleTime: 300_000,
  });

  // Query 3: Holdings & Activities
  const holdingsAndActivitiesQuery = useQuery({
    queryKey: ['assets-performance-holdings-activities', scope.type, scope.id],
    queryFn: async () => {
      const accounts = (accountsQuery.data ||
        (await api.accounts.getAll().catch(() => []))) as Account[];
      const activeAccounts = accounts.filter((a) => !a.isArchived);

      let targetAccounts: Account[] = [];
      if (scope.type === 'all') {
        targetAccounts = activeAccounts;
      } else if (scope.type === 'group' && scope.id) {
        targetAccounts = activeAccounts.filter((a) => a.group === scope.id);
      } else if ((scope.type === 'account' || scope.type === 'portfolio') && scope.id) {
        targetAccounts = activeAccounts.filter((a) => a.id === scope.id);
      } else {
        targetAccounts = activeAccounts;
      }

      if (targetAccounts.length === 0) {
        return { holdings: [] as Holding[], activities: [] as ActivityDetails[] };
      }

      // Fetch holdings in parallel
      const holdingsPromises = targetAccounts.map((acc) =>
        api.portfolio.getHoldings(acc.id).catch(() => [] as Holding[]),
      );

      // Fetch activities in parallel
      const activitiesPromises = targetAccounts.map((acc) =>
        api.activities.getAll(acc.id).catch(() => [] as ActivityDetails[]),
      );

      const [holdingsResults, activitiesResults] = await Promise.all([
        Promise.all(holdingsPromises),
        Promise.all(activitiesPromises),
      ]);

      return {
        holdings: holdingsResults.flat(),
        activities: activitiesResults.flat(),
      };
    },
    enabled: accountsQuery.isSuccess,
    staleTime: 60_000,
  });

  // Query 4: Portfolio Performance History
  const portfolioHistoryQuery = useQuery({
    queryKey: ['assets-performance-portfolio-series', scope.type, scope.id],
    queryFn: async (): Promise<ReturnData[]> => {
      try {
        if ((scope.type === 'account' || scope.type === 'portfolio') && scope.id) {
          const res = await api.performance.calculateHistory('account', scope.id);
          return res?.series ?? [];
        }

        if (scope.type === 'all') {
          try {
            const res = await api.performance.calculateHistory('account', 'portfolio:all');
            if (res?.series && res.series.length >= 2) {
              return res.series;
            }
          } catch {
            // fallback
          }
        }

        const accounts = (accountsQuery.data || []) as Account[];
        const activeAccounts = accounts.filter((a) => !a.isArchived);
        const scopedAccounts =
          scope.type === 'group' && scope.id
            ? activeAccounts.filter((a) => a.group === scope.id)
            : activeAccounts;

        if (scopedAccounts.length === 0) return [];
        if (scopedAccounts.length === 1) {
          const res = await api.performance.calculateHistory('account', scopedAccounts[0].id);
          return res?.series ?? [];
        }

        const results = await Promise.allSettled(
          scopedAccounts.map((a) => api.performance.calculateHistory('account', a.id)),
        );

        const validResults = results
          .filter(
            (r): r is PromiseFulfilledResult<PerformanceResult> =>
              r.status === 'fulfilled' && Boolean(r.value?.series && r.value.series.length >= 2),
          )
          .map((r) => r.value);

        if (validResults.length === 0) return [];
        if (validResults.length === 1) return validResults[0].series;

        // Merge returns by date
        const dateMap = new Map<string, number[]>();
        for (const res of validResults) {
          for (const pt of res.series) {
            const list = dateMap.get(pt.date) ?? [];
            list.push(pt.value);
            dateMap.set(pt.date, list);
          }
        }

        const sortedDates = Array.from(dateMap.keys()).sort();
        return sortedDates.map((date) => {
          const vals = dateMap.get(date)!;
          const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
          return { date, value: avg };
        });
      } catch (err) {
        console.warn('Failed to calculate portfolio history series:', err);
        return [];
      }
    },
    enabled: accountsQuery.isSuccess,
    staleTime: 120_000,
  });

  // Query 5: Benchmark Performance History
  const benchmarkHistoryQuery = useQuery({
    queryKey: ['assets-performance-benchmark-series', benchmarkSymbol],
    queryFn: async (): Promise<ReturnData[]> => {
      if (!benchmarkSymbol || !benchmarkSymbol.trim()) return [];
      try {
        const res = await api.performance.calculateHistory(
          'symbol',
          benchmarkSymbol.trim(),
          '2000-01-01',
        );
        return res?.series ?? [];
      } catch (err) {
        console.warn(`Failed to fetch benchmark series for ${benchmarkSymbol}:`, err);
        return [];
      }
    },
    enabled: Boolean(benchmarkSymbol && benchmarkSymbol.trim()),
    staleTime: 300_000,
  });

  // Extract raw data
  const rawHoldings = holdingsAndActivitiesQuery.data?.holdings ?? [];
  const rawActivities = holdingsAndActivitiesQuery.data?.activities ?? [];
  const portfolioSeries = portfolioHistoryQuery.data ?? [];
  const benchmarkSeries = benchmarkHistoryQuery.data ?? [];

  // Query 6: Quote / Price history for all unique symbols and assets in portfolio
  const assetIdentifiers = useMemo(() => {
    const list: Array<{ symbol: string; assetId?: string }> = [];
    const seen = new Set<string>();

    for (const h of rawHoldings) {
      const sym = h.instrument?.symbol;
      const assetId = h.instrument?.id || h.id;
      const key = `${sym || ''}:${assetId || ''}`;

      if (!seen.has(key) && (sym || assetId)) {
        seen.add(key);
        if (sym && sym !== 'CASH' && sym !== 'cash') {
          list.push({ symbol: sym, assetId });
        } else if (assetId) {
          list.push({ symbol: assetId, assetId });
        }
      }
    }
    return list;
  }, [rawHoldings]);

  const identifiersKey = assetIdentifiers
    .map((i) => `${i.symbol}:${i.assetId || ''}`)
    .sort()
    .join(',');

  const assetSeriesQuery = useQuery({
    queryKey: ['assets-quote-series', identifiersKey],
    queryFn: async () => {
      if (assetIdentifiers.length === 0) return new Map<string, ReturnData[]>();

      const resultMap = new Map<string, ReturnData[]>();
      const results = await Promise.allSettled(
        assetIdentifiers.map(async ({ symbol, assetId }) => {
          let series: ReturnData[] = [];

          // 1. Try quotes.getHistory by symbol or assetId
          if (api.quotes?.getHistory) {
            try {
              const quotes =
                (await api.quotes.getHistory(symbol)) ||
                (assetId ? await api.quotes.getHistory(assetId) : []);
              if (Array.isArray(quotes) && quotes.length > 0) {
                series = quotes
                  .map((q: unknown) => {
                    const quoteObj = q as {
                      timestamp?: string;
                      date?: string;
                      close?: number;
                      adjclose?: number;
                      price?: number;
                    };
                    const dateStr = (quoteObj.timestamp || quoteObj.date || '').split('T')[0];
                    const val = Number(quoteObj.adjclose ?? quoteObj.close ?? quoteObj.price ?? 0);
                    return { date: dateStr, value: val };
                  })
                  .filter((p) => Boolean(p.date) && p.value > 0)
                  .sort((a, b) => a.date.localeCompare(b.date));
              }
            } catch {
              // Ignore and fallback
            }
          }

          // 2. Fallback to performance.calculateHistory
          if (series.length === 0 && api.performance?.calculateHistory) {
            try {
              const res = await api.performance.calculateHistory('symbol', symbol, '2000-01-01');
              if (res?.series && res.series.length > 0) {
                series = res.series;
              }
            } catch {
              // Ignore
            }
          }

          return { symbol, assetId, series };
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.series.length > 0) {
          resultMap.set(r.value.symbol, r.value.series);
          if (r.value.assetId) {
            resultMap.set(r.value.assetId, r.value.series);
          }
        }
      }

      return resultMap;
    },
    enabled: assetIdentifiers.length > 0,
    staleTime: 300_000,
  });

  const assetSeriesMap = assetSeriesQuery.data ?? new Map<string, ReturnData[]>();
  const baseCurrency = (settingsQuery.data as { baseCurrency?: string })?.baseCurrency || 'USD';

  // Process & Aggregate Assets inside useMemo
  const { processedAssets, totalPortfolioValue, correlationMatrix } = useMemo(() => {
    interface AggregatedAsset {
      assetId: string;
      symbol: string;
      name: string;
      currency: string;
      assetClass?: string;
      quantity: number;
      marketValueBase: number;
      marketValueLocal: number;
      costBasisBase: number;
      costBasisLocal: number;
      unrealizedGainBase: number;
      realizedGainBase: number;
      totalGainBase: number;
      totalReturnBase: number;
      returnBasisBase: number;
      price: number;
      openDate: string | Date | null;
    }

    const aggregatedMap = new Map<string, AggregatedAsset>();

    for (const h of rawHoldings) {
      if (h.holdingType === 'cash') continue;

      const symbol = h.instrument?.symbol || h.id;
      const assetId = h.instrument?.id || h.id;
      const name = h.instrument?.name || symbol;
      const currency = h.localCurrency || baseCurrency;
      const assetClass = (h.instrument as { classifications?: { assetType?: { name?: string } } })
        ?.classifications?.assetType?.name;

      const existing = aggregatedMap.get(symbol);
      const mValBase = Number(h.marketValue?.base ?? 0);
      const mValLoc = Number(h.marketValue?.local ?? 0);
      const costBase = Number(h.costBasis?.base ?? 0);
      const costLoc = Number(h.costBasis?.local ?? 0);
      const unPnlBase = Number(h.unrealizedGain?.base ?? 0);
      const rePnlBase = Number(h.realizedGain?.base ?? 0);
      const totGainBase = Number(h.totalGain?.base ?? 0);
      const totRetBase = Number(h.totalReturn?.base ?? 0);
      const retBasisBase = Number(h.returnBasis?.base ?? costBase);
      const qty = Number(h.quantity ?? 0);
      const price = Number(h.price ?? (qty > 0 ? mValLoc / qty : 0));

      const openDate = h.openDate ?? null;

      if (existing) {
        existing.quantity += qty;
        existing.marketValueBase += mValBase;
        existing.marketValueLocal += mValLoc;
        existing.costBasisBase += costBase;
        existing.costBasisLocal += costLoc;
        existing.unrealizedGainBase += unPnlBase;
        existing.realizedGainBase += rePnlBase;
        existing.totalGainBase += totGainBase;
        existing.totalReturnBase += totRetBase;
        existing.returnBasisBase += retBasisBase;
        if (openDate && (!existing.openDate || new Date(openDate) < new Date(existing.openDate))) {
          existing.openDate = openDate;
        }
      } else {
        aggregatedMap.set(symbol, {
          assetId,
          symbol,
          name,
          currency,
          assetClass,
          quantity: qty,
          marketValueBase: mValBase,
          marketValueLocal: mValLoc,
          costBasisBase: costBase,
          costBasisLocal: costLoc,
          unrealizedGainBase: unPnlBase,
          realizedGainBase: rePnlBase,
          totalGainBase: totGainBase,
          totalReturnBase: totRetBase,
          returnBasisBase: retBasisBase,
          price,
          openDate,
        });
      }
    }

    const portfolioVal = Array.from(aggregatedMap.values()).reduce(
      (sum, a) => sum + Math.max(0, a.marketValueBase),
      0,
    );

    const now = new Date();
    const assetsList: AssetPerformanceItem[] = [];

    for (const agg of aggregatedMap.values()) {
      const cashFlows: DatedCashFlow[] = [];

      const matchingActivities = rawActivities.filter(
        (act) =>
          act.assetSymbol === agg.symbol ||
          act.assetId === agg.assetId ||
          (act as { symbol?: string }).symbol === agg.symbol,
      );

      let earliestActivityDate: Date | null = null;

      for (const act of matchingActivities) {
        const actDate = act.date;
        if (!actDate) continue;

        const dateObj = new Date(actDate);
        if (!earliestActivityDate || dateObj < earliestActivityDate) {
          earliestActivityDate = dateObj;
        }

        const actType = String(act.activityType).toUpperCase();
        if (actType === 'BUY' || actType === 'TRANSFER_IN') {
          const cost =
            Number(act.amount ?? 0) > 0
              ? Number(act.amount)
              : Number(act.unitPrice ?? 0) * Number(act.quantity ?? 0) + Number(act.fee ?? 0);
          if (cost > 0) {
            cashFlows.push({ date: actDate, amount: -cost });
          }
        } else if (actType === 'SELL' || actType === 'TRANSFER_OUT') {
          const proceeds =
            Number(act.amount ?? 0) > 0
              ? Number(act.amount)
              : Number(act.unitPrice ?? 0) * Number(act.quantity ?? 0) - Number(act.fee ?? 0);
          if (proceeds > 0) {
            cashFlows.push({ date: actDate, amount: proceeds });
          }
        } else if (actType === 'DIVIDEND' || actType === 'INTEREST') {
          const inc = Number(act.amount ?? 0);
          if (inc > 0) {
            cashFlows.push({ date: actDate, amount: inc });
          }
        }
      }

      // Fallback if no activities: use cost basis as initial cash outflow
      if (cashFlows.length === 0 && agg.costBasisBase > 0) {
        cashFlows.push({
          date: agg.openDate || new Date(now.getTime() - 365 * 24 * 3600 * 1000),
          amount: -agg.costBasisBase,
        });
      }

      // Terminal market value cash flow (positive flow at current time)
      if (agg.marketValueBase > 0) {
        cashFlows.push({
          date: now,
          amount: agg.marketValueBase,
        });
      }

      // Effective open date
      const effectiveOpenDate = agg.openDate || earliestActivityDate;

      // Returns calculations
      const totalReturnPercent =
        agg.returnBasisBase > 0 ? agg.totalReturnBase / agg.returnBasisBase : null;
      const totalGainPercent = agg.costBasisBase > 0 ? agg.totalGainBase / agg.costBasisBase : null;
      const unrealizedPnlPercent =
        agg.costBasisBase > 0 ? agg.unrealizedGainBase / agg.costBasisBase : null;

      const perf = computeHoldingPerformance({
        totalReturnPct: totalReturnPercent ?? totalGainPercent,
        openDate: effectiveOpenDate,
        cashFlows: cashFlows.length >= 2 ? cashFlows : undefined,
      });

      const quotesSeries =
        assetSeriesMap.get(agg.symbol) ??
        (agg.assetId ? assetSeriesMap.get(agg.assetId) : undefined) ??
        [];

      // Filter series for risk metrics according to dateRange or holding open date
      const openDateIso = effectiveOpenDate
        ? (typeof effectiveOpenDate === 'string'
            ? effectiveOpenDate
            : effectiveOpenDate.toISOString()
          ).split('T')[0]
        : undefined;

      const effectiveRange =
        dateRange ?? (openDateIso ? { from: new Date(openDateIso), to: undefined } : undefined);

      const filteredQuotes = filterSeriesByDateRange(quotesSeries, effectiveRange);
      const filteredBenchmark = filterSeriesByDateRange(benchmarkSeries, effectiveRange);
      const filteredPortfolio = filterSeriesByDateRange(portfolioSeries, effectiveRange);

      const riskMetrics = calculateAssetRiskMetrics({
        assetSeries: filteredQuotes.length >= 2 ? filteredQuotes : quotesSeries,
        benchmarkSeries: filteredBenchmark.length >= 2 ? filteredBenchmark : benchmarkSeries,
        portfolioSeries: filteredPortfolio.length >= 2 ? filteredPortfolio : portfolioSeries,
      });

      const weight = portfolioVal > 0 ? (agg.marketValueBase / portfolioVal) * 100 : 0;

      assetsList.push({
        id: agg.assetId || agg.symbol,
        assetId: agg.assetId,
        symbol: agg.symbol,
        name: agg.name,
        currency: agg.currency,
        assetClass: agg.assetClass,
        quantity: agg.quantity,
        marketPrice: agg.price,
        marketValue: agg.marketValueBase,
        marketValueLocal: agg.marketValueLocal,
        costBasis: agg.costBasisBase,
        costBasisLocal: agg.costBasisLocal,
        unrealizedPnl: agg.unrealizedGainBase,
        unrealizedPnlPercent,
        realizedPnl: agg.realizedGainBase,
        totalGain: agg.totalGainBase,
        totalGainPercent,
        totalReturn: agg.totalReturnBase,
        totalReturnPercent,
        weight,
        openDate: effectiveOpenDate,
        cashFlows,
        perf,
        quotesSeries,
        riskMetrics,
      });
    }

    assetsList.sort((a, b) => b.marketValue - a.marketValue);

    const matrix = buildCorrelationMatrix(
      assetsList.map((a) => ({
        id: a.assetId,
        symbol: a.symbol,
        name: a.name,
        series: a.quotesSeries,
      })),
      correlationTimeframe ?? dateRange ?? '1Y',
    );

    return {
      processedAssets: assetsList,
      totalPortfolioValue: portfolioVal,
      correlationMatrix: matrix,
    };
  }, [
    rawHoldings,
    rawActivities,
    assetSeriesMap,
    benchmarkSeries,
    portfolioSeries,
    baseCurrency,
    dateRange,
    correlationTimeframe,
  ]);

  const portfolioName =
    scope.type === 'account' && scope.label
      ? scope.label
      : (scope.type === 'portfolio' || scope.type === 'group') && scope.label
        ? `Portfolio: ${scope.label}`
        : 'All Portfolios';

  const isLoading =
    accountsQuery.isLoading ||
    holdingsAndActivitiesQuery.isLoading ||
    portfolioHistoryQuery.isLoading ||
    benchmarkHistoryQuery.isLoading ||
    assetSeriesQuery.isLoading;

  const isFetching =
    accountsQuery.isFetching ||
    holdingsAndActivitiesQuery.isFetching ||
    portfolioHistoryQuery.isFetching ||
    benchmarkHistoryQuery.isFetching ||
    assetSeriesQuery.isFetching;

  const error =
    accountsQuery.error ||
    holdingsAndActivitiesQuery.error ||
    portfolioHistoryQuery.error ||
    benchmarkHistoryQuery.error;

  const refetch = async () => {
    await Promise.all([
      accountsQuery.refetch(),
      holdingsAndActivitiesQuery.refetch(),
      portfolioHistoryQuery.refetch(),
      benchmarkHistoryQuery.refetch(),
      assetSeriesQuery.refetch(),
    ]);
  };

  return {
    data: {
      assets: processedAssets,
      correlationMatrix,
      portfolioSeries,
      benchmarkSeries,
      portfolioName,
      benchmarkName: benchmarkSymbol,
      baseCurrency,
      totalPortfolioValue,
    },
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
