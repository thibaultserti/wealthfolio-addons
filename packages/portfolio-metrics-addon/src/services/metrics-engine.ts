import type { Holding, Asset } from '@wealthfolio/addon-sdk';
import type {
  AccountScope,
  PortfolioAggregatedMetrics,
  RawStockFinancials,
  StockHoldingMetric,
} from '../types';

/**
 * Identify if a holding is cash
 */
/**
 * Identify if a holding is cash or fiat currency
 */
export function isCashHolding(holding: Holding): boolean {
  if (holding.holdingType === 'cash') return true;
  const sym = (holding.instrument?.symbol || '').toUpperCase().trim();
  const id = (holding.instrument?.id || '').toLowerCase().trim();
  if (
    id.startsWith('cash:') ||
    sym === '$CASH' ||
    sym.startsWith('CASH-') ||
    sym.startsWith('CASH:')
  ) {
    return true;
  }
  const classifications = holding.instrument?.classifications as
    { assetType?: { id?: string; key?: string; parentId?: string } } | undefined;
  const assetTypeId = classifications?.assetType?.id || classifications?.assetType?.key;
  const assetTypeParent = classifications?.assetType?.parentId;
  if (assetTypeId === 'CASH' || assetTypeId === 'DEPOSIT' || assetTypeParent === 'CASH_FX') {
    return true;
  }
  const FIAT_CURRENCIES = new Set([
    'EUR',
    'USD',
    'GBP',
    'CAD',
    'CHF',
    'JPY',
    'AUD',
    'NZD',
    'SEK',
    'NOK',
    'DKK',
    'PLN',
    'SGD',
    'HKD',
  ]);
  if (
    FIAT_CURRENCIES.has(sym) &&
    (id.includes('cash') || holding.instrument?.quoteMode === 'MANUAL')
  ) {
    return true;
  }
  return false;
}

/**
 * Identify if a holding is an ETF, Index Fund, or Crypto (to isolate Individual Stocks)
 */
export function isEtfOrFund(holding: Holding, assetProfile?: Asset): boolean {
  if (isCashHolding(holding)) return true;
  const classifications = holding.instrument?.classifications as
    { assetType?: { id?: string; key?: string; parentId?: string } } | undefined;
  const assetTypeId = classifications?.assetType?.id || classifications?.assetType?.key;
  const assetTypeParent = classifications?.assetType?.parentId;

  if (
    assetTypeId === 'ETF' ||
    assetTypeId === 'ETN' ||
    assetTypeId === 'ETC' ||
    assetTypeId === 'FUND_MUTUAL' ||
    assetTypeId === 'FUND_CLOSED_END' ||
    assetTypeParent === 'ETP' ||
    assetTypeParent === 'FUND'
  ) {
    return true;
  }

  const metaProfile = (holding as unknown as { metadata?: { profile?: { quoteType?: string } } })
    .metadata?.profile;
  const quoteType =
    metaProfile?.quoteType?.toUpperCase() ||
    (assetProfile as unknown as { quoteType?: string })?.quoteType?.toUpperCase();
  if (quoteType === 'ETF' || quoteType === 'MUTUALFUND' || quoteType === 'INDEX') {
    return true;
  }

  const name = (holding.instrument?.name || assetProfile?.name || '').toUpperCase();
  if (
    name.includes(' ETF') ||
    name.startsWith('ETF ') ||
    name.includes('UCITS') ||
    name.includes('ISHARES') ||
    name.includes('VANGUARD') ||
    name.includes('AMUNDI') ||
    name.includes('LYXOR') ||
    name.includes('XTRACKERS') ||
    name.includes('SPDR') ||
    name.includes('WISDOMTREE') ||
    name.includes('MSCI WORLD') ||
    name.includes('S&P 500 ETF') ||
    name.includes('CAC 40 ETF')
  ) {
    return true;
  }

  return false;
}

/**
 * Resolve candidate Yahoo tickers for international stocks
 */
export function resolveCandidateTickers(
  symbol: string,
  exchangeMic?: string,
  currency?: string,
): { primaryTicker: string; fallbackTickers: string[]; effectiveMic?: string } {
  const cleanSymbol = symbol.trim().toUpperCase();

  if (cleanSymbol.includes('.')) {
    return {
      primaryTicker: cleanSymbol,
      fallbackTickers: [cleanSymbol.split('.')[0]],
      effectiveMic: exchangeMic,
    };
  }

  const mic = (exchangeMic || '').toUpperCase();
  const ccy = (currency || '').toUpperCase();

  if (mic === 'XPAR' || (ccy === 'EUR' && (!mic || mic === 'PAR' || mic === 'ENX'))) {
    return {
      primaryTicker: `${cleanSymbol}.PA`,
      fallbackTickers: [cleanSymbol],
      effectiveMic: 'XPAR',
    };
  }
  if (mic === 'XAMS' || (ccy === 'EUR' && mic === 'AMS')) {
    return {
      primaryTicker: `${cleanSymbol}.AS`,
      fallbackTickers: [`${cleanSymbol}.PA`, cleanSymbol],
      effectiveMic: 'XAMS',
    };
  }
  if (mic === 'XBRU' || (ccy === 'EUR' && mic === 'BRU')) {
    return {
      primaryTicker: `${cleanSymbol}.BR`,
      fallbackTickers: [`${cleanSymbol}.PA`, cleanSymbol],
      effectiveMic: 'XBRU',
    };
  }
  if (mic === 'XETR' || mic === 'XFRA' || mic === 'FRA') {
    return {
      primaryTicker: `${cleanSymbol}.DE`,
      fallbackTickers: [`${cleanSymbol}.F`, cleanSymbol],
      effectiveMic: 'XETR',
    };
  }
  if (mic === 'XMIL' || mic === 'MTAA') {
    return {
      primaryTicker: `${cleanSymbol}.MI`,
      fallbackTickers: [cleanSymbol],
      effectiveMic: 'XMIL',
    };
  }
  if (mic === 'XMAD' || mic === 'MCE') {
    return {
      primaryTicker: `${cleanSymbol}.MC`,
      fallbackTickers: [cleanSymbol],
      effectiveMic: 'XMAD',
    };
  }
  if (mic === 'XLON' || ccy === 'GBP') {
    return {
      primaryTicker: `${cleanSymbol}.L`,
      fallbackTickers: [cleanSymbol],
      effectiveMic: 'XLON',
    };
  }
  if (mic === 'XTSE' || mic === 'XTSX' || ccy === 'CAD') {
    return {
      primaryTicker: `${cleanSymbol}.TO`,
      fallbackTickers: [`${cleanSymbol}.V`, cleanSymbol],
      effectiveMic: 'XTSE',
    };
  }

  return {
    primaryTicker: cleanSymbol,
    fallbackTickers: ccy === 'EUR' ? [`${cleanSymbol}.PA`] : [],
    effectiveMic: mic || undefined,
  };
}

/**
 * Calculate the Quality Score (Note Q) out of 20 for a stock
 */
export function calculateQualityScore(financials: Partial<RawStockFinancials>): number {
  let score = 0;

  // 1. Marges (Max 5 points)
  const gross = financials.grossMargins ? financials.grossMargins * 100 : null;
  const op = financials.operatingMargins ? financials.operatingMargins * 100 : null;
  const net = financials.profitMargins ? financials.profitMargins * 100 : null;

  if (gross !== null) {
    if (gross >= 50) score += 1.5;
    else if (gross >= 35) score += 1.0;
    else if (gross >= 20) score += 0.5;
  }
  if (op !== null) {
    if (op >= 20) score += 1.75;
    else if (op >= 12) score += 1.25;
    else if (op >= 6) score += 0.5;
  }
  if (net !== null) {
    if (net >= 15) score += 1.75;
    else if (net >= 10) score += 1.25;
    else if (net >= 5) score += 0.5;
  }

  // 2. Retours sur capitaux (Max 5 points)
  const roic =
    financials.roic ?? (financials.returnOnAssets ? financials.returnOnAssets * 200 : null);
  const roe = financials.returnOnEquity ? financials.returnOnEquity * 100 : null;
  const roce = financials.roce ?? (roic ? roic * 0.95 : null);

  if (roic !== null) {
    if (roic >= 20) score += 2.0;
    else if (roic >= 12) score += 1.25;
    else if (roic >= 6) score += 0.5;
  }
  if (roce !== null) {
    if (roce >= 18) score += 1.5;
    else if (roce >= 10) score += 1.0;
    else if (roce >= 5) score += 0.5;
  }
  if (roe !== null) {
    if (roe >= 20) score += 1.5;
    else if (roe >= 12) score += 1.0;
    else if (roe >= 6) score += 0.5;
  }

  // 3. Croissance (Max 4 points)
  const revGrowth = financials.revenueGrowth ? financials.revenueGrowth * 100 : null;
  const epsGrowth = financials.earningsGrowth ? financials.earningsGrowth * 100 : null;
  const fcfGrowth = financials.fcfGrowth ?? (epsGrowth ? epsGrowth * 0.8 : null);

  if (revGrowth !== null) {
    if (revGrowth >= 12) score += 1.5;
    else if (revGrowth >= 6) score += 1.0;
    else if (revGrowth > 0) score += 0.5;
  }
  if (epsGrowth !== null) {
    if (epsGrowth >= 15) score += 1.5;
    else if (epsGrowth >= 8) score += 1.0;
    else if (epsGrowth > 0) score += 0.5;
  }
  if (fcfGrowth !== null) {
    if (fcfGrowth >= 10) score += 1.0;
    else if (fcfGrowth > 0) score += 0.5;
  }

  // 4. Santé financière (Max 4 points)
  const netDebtToEbitda = financials.netDebtToEbitda ?? 0;
  const interestCoverage = financials.interestCoverage ?? 20;
  const goodwillToAssets = financials.goodwillToAssets ?? 10;

  if (netDebtToEbitda <= 0) {
    score += 1.5; // Cash net positif
  } else if (netDebtToEbitda <= 1.5) {
    score += 1.25;
  } else if (netDebtToEbitda <= 3.0) {
    score += 0.5;
  }

  if (interestCoverage >= 15) {
    score += 1.5;
  } else if (interestCoverage >= 6) {
    score += 1.0;
  } else if (interestCoverage >= 3) {
    score += 0.5;
  }

  if (goodwillToAssets <= 15) {
    score += 1.0;
  } else if (goodwillToAssets <= 35) {
    score += 0.5;
  }

  // 5. Valorisation & solidité (Max 2 points)
  const pe = financials.trailingPE || financials.forwardPE;
  if (pe && pe > 0 && pe <= 25) {
    score += 1.0;
  } else if (pe && pe > 0 && pe <= 35) {
    score += 0.5;
  }

  const pb = financials.priceToBook;
  if (pb && pb > 0) {
    score += 1.0;
  }

  return Math.min(20, Math.max(0, Math.round(score * 10) / 10));
}

/**
 * Weighted average helper ignoring nulls
 */
export function calculateWeightedAverage(
  items: { value: number | null | undefined; weight: number }[],
): number | null {
  let totalWeightedValue = 0;
  let totalWeight = 0;

  for (const item of items) {
    if (item.value !== null && item.value !== undefined && !isNaN(item.value)) {
      totalWeightedValue += item.value * item.weight;
      totalWeight += item.weight;
    }
  }

  if (totalWeight <= 0) return null;
  return totalWeightedValue / totalWeight;
}

/**
 * Aggregate metrics for a collection of holdings
 */
export function aggregatePortfolioMetrics({
  holdings,
  financialsBySymbol,
  assetProfilesById,
  scope,
  baseCurrency = 'USD',
}: {
  holdings: Holding[];
  financialsBySymbol: Record<string, RawStockFinancials>;
  assetProfilesById?: Record<string, Asset>;
  scope: AccountScope;
  baseCurrency?: string;
}): PortfolioAggregatedMetrics {
  // Filter out cash
  const nonCashHoldings = holdings.filter(
    (h) => !isCashHolding(h) && (Number(h.quantity) || 0) > 0,
  );

  // Total portfolio market value and cost basis
  const totalPortfolioMarketValue = nonCashHoldings.reduce(
    (sum, h) => sum + (Number(h.marketValue?.base ?? h.marketValue?.local) || 0),
    0,
  );

  let totalCostBasis = 0;
  let totalUnrealizedGain = 0;

  const stockHoldingMetrics: StockHoldingMetric[] = [];
  let nonStockCount = 0;

  for (const h of nonCashHoldings) {
    const rawSymbol = h.instrument?.symbol || '';
    const assetId = h.instrument?.id;
    const profile = assetId && assetProfilesById ? assetProfilesById[assetId] : undefined;
    const isFund = isEtfOrFund(h, profile);

    const mVal = Number(h.marketValue?.base ?? h.marketValue?.local) || 0;
    const cBasis = Number(h.costBasis?.base ?? h.costBasis?.local) || mVal;
    const shares = Number(h.quantity) || 0;
    const price = Number(h.price) || (shares > 0 ? mVal / shares : 0);
    const rawUnGain = h.unrealizedGain?.base ?? h.unrealizedGain?.local;
    const unGain = rawUnGain != null ? Number(rawUnGain) : mVal - cBasis;
    const unGainPct = cBasis > 0 ? ((mVal - cBasis) / cBasis) * 100 : 0;

    totalCostBasis += cBasis;
    totalUnrealizedGain += unGain;

    if (isFund) {
      nonStockCount++;
      continue;
    }

    const { primaryTicker } = resolveCandidateTickers(
      rawSymbol,
      profile?.instrumentExchangeMic || undefined,
      profile?.quoteCcy || h.localCurrency,
    );

    const fin =
      financialsBySymbol[rawSymbol] ||
      financialsBySymbol[primaryTicker] ||
      (assetId ? financialsBySymbol[assetId] : undefined) ||
      {};

    const weight = totalPortfolioMarketValue > 0 ? (mVal / totalPortfolioMarketValue) * 100 : 0;

    // Quality score
    const qualityScore = calculateQualityScore(fin);

    // Margins (in %)
    const grossMargin = fin.grossMargins != null ? fin.grossMargins * 100 : null;
    const operatingMargin = fin.operatingMargins != null ? fin.operatingMargins * 100 : null;
    const netMargin = fin.profitMargins != null ? fin.profitMargins * 100 : null;

    // Returns on Capital (in %)
    const roic =
      fin.roic != null ? fin.roic : fin.returnOnAssets != null ? fin.returnOnAssets * 200 : null;
    const roce = fin.roce != null ? fin.roce : roic != null ? roic * 0.95 : null;
    const roe = fin.returnOnEquity != null ? fin.returnOnEquity * 100 : null;

    // Growth (in %)
    const revenueGrowth = fin.revenueGrowth != null ? fin.revenueGrowth * 100 : null;
    const epsGrowth = fin.earningsGrowth != null ? fin.earningsGrowth * 100 : null;
    const fcfGrowth =
      fin.fcfGrowth != null ? fin.fcfGrowth : epsGrowth != null ? epsGrowth * 0.8 : null;

    // Financial Health
    const netDebtToEbitda = fin.netDebtToEbitda ?? null;
    const interestCoverage = fin.interestCoverage ?? null;
    const goodwillToAssets = fin.goodwillToAssets ?? null;

    // Valuation
    const peRatio = fin.trailingPE || fin.forwardPE || null;
    const forwardPE = fin.forwardPE || (peRatio ? peRatio * 0.92 : null);
    // P/E on Cost Basis = Current PE * (Cost Basis / Market Value)
    const costRatio = mVal > 0 && cBasis > 0 ? cBasis / mVal : 1;
    const peOnCost = peRatio != null ? peRatio * costRatio : null;

    let pegRatio = fin.pegRatio ?? null;
    if (pegRatio == null && epsGrowth && epsGrowth > 0 && peRatio) {
      pegRatio = Math.round((peRatio / epsGrowth) * 100) / 100;
    }

    const pfcfRatio = fin.priceToFreeCashFlow ?? (peRatio != null ? peRatio * 1.15 : null);
    const pfcfOnCost = pfcfRatio != null ? pfcfRatio * costRatio : null;
    const evToEbitda = fin.enterpriseToEbitda ?? null;

    const exchangeMic =
      (h.instrument as { exchangeMic?: string })?.exchangeMic ||
      profile?.instrumentExchangeMic ||
      undefined;
    const instrumentType = h.assetKind || undefined;
    const marketCap = fin.marketCap ? fin.marketCap / 1_000_000 : 0;

    stockHoldingMetrics.push({
      id: h.id || rawSymbol,
      assetId,
      symbol: rawSymbol,
      name: h.instrument?.name || profile?.name || rawSymbol,
      currency: h.localCurrency || h.instrument?.currency || baseCurrency,
      exchangeMic,
      instrumentType,
      shares,
      price,
      marketValue: mVal,
      costBasis: cBasis,
      unrealizedGain: unGain,
      unrealizedGainPct: unGainPct,
      weight,
      isStockOnly: true,
      marketCap,
      qualityScore,
      grossMargin,
      operatingMargin,
      netMargin,
      roic,
      roce,
      roe,
      revenueGrowth,
      epsGrowth,
      fcfGrowth,
      netDebtToEbitda,
      interestCoverage,
      goodwillToAssets,
      peRatio,
      forwardPE,
      peOnCost,
      pegRatio,
      pfcfRatio,
      pfcfOnCost,
      evToEbitda,
    });
  }

  // Sort by weight descending
  stockHoldingMetrics.sort((a, b) => b.weight - a.weight);

  // Top 5 & Top 10 Concentration
  const top5Holdings = stockHoldingMetrics.slice(0, 5);
  const top5Concentration = top5Holdings.reduce((sum, h) => sum + h.weight, 0);

  const top10Holdings = stockHoldingMetrics.slice(0, 10);
  const top10Concentration = top10Holdings.reduce((sum, h) => sum + h.weight, 0);

  // Weighted Averages
  const totalStockMarketValue = stockHoldingMetrics.reduce((sum, h) => sum + h.marketValue, 0);
  const itemsWithWeight = (getValue: (h: StockHoldingMetric) => number | null | undefined) =>
    stockHoldingMetrics.map((h) => ({
      value: getValue(h),
      weight: totalStockMarketValue > 0 ? h.marketValue / totalStockMarketValue : 1,
    }));

  const weightedMarketCap = calculateWeightedAverage(itemsWithWeight((h) => h.marketCap)) || 0;
  const weightedQualityScore =
    calculateWeightedAverage(itemsWithWeight((h) => h.qualityScore)) || 0;

  const weightedGrossMargin = calculateWeightedAverage(itemsWithWeight((h) => h.grossMargin));
  const weightedOperatingMargin = calculateWeightedAverage(
    itemsWithWeight((h) => h.operatingMargin),
  );
  const weightedNetMargin = calculateWeightedAverage(itemsWithWeight((h) => h.netMargin));

  const weightedRoic = calculateWeightedAverage(itemsWithWeight((h) => h.roic));
  const weightedRoce = calculateWeightedAverage(itemsWithWeight((h) => h.roce));
  const weightedRoe = calculateWeightedAverage(itemsWithWeight((h) => h.roe));

  const weightedRevGrowth = calculateWeightedAverage(itemsWithWeight((h) => h.revenueGrowth));
  const weightedEpsGrowth = calculateWeightedAverage(itemsWithWeight((h) => h.epsGrowth));
  const weightedFcfGrowth = calculateWeightedAverage(itemsWithWeight((h) => h.fcfGrowth));

  const weightedNetDebtToEbitda = calculateWeightedAverage(
    itemsWithWeight((h) => h.netDebtToEbitda),
  );
  const weightedInterestCoverage = calculateWeightedAverage(
    itemsWithWeight((h) => h.interestCoverage),
  );
  const weightedGoodwillToAssets = calculateWeightedAverage(
    itemsWithWeight((h) => h.goodwillToAssets),
  );

  const weightedPeRatio = calculateWeightedAverage(itemsWithWeight((h) => h.peRatio));
  const weightedForwardPe = calculateWeightedAverage(itemsWithWeight((h) => h.forwardPE));
  const weightedPeOnCost = calculateWeightedAverage(itemsWithWeight((h) => h.peOnCost));
  const weightedPegRatio = calculateWeightedAverage(itemsWithWeight((h) => h.pegRatio));
  const weightedPfcfRatio = calculateWeightedAverage(itemsWithWeight((h) => h.pfcfRatio));
  const weightedPfcfOnCost = calculateWeightedAverage(itemsWithWeight((h) => h.pfcfOnCost));
  const weightedEvToEbitda = calculateWeightedAverage(itemsWithWeight((h) => h.evToEbitda));

  const totalUnrealizedGainPct =
    totalCostBasis > 0 ? ((totalPortfolioMarketValue - totalCostBasis) / totalCostBasis) * 100 : 0;

  return {
    scope,
    baseCurrency,
    totalMarketValue: totalPortfolioMarketValue,
    totalCostBasis,
    totalUnrealizedGain,
    totalUnrealizedGainPct,
    holdings: stockHoldingMetrics,
    top5Holdings,
    top10Holdings,
    nonStockHoldingsCount: nonStockCount,
    general: {
      stockCount: stockHoldingMetrics.length,
      top5Concentration: Math.min(100, Math.round(top5Concentration * 100) / 100),
      top10Concentration: Math.min(100, Math.round(top10Concentration * 100) / 100),
      weightedMarketCap: Math.round(weightedMarketCap * 10) / 10,
      qualityScore: Math.round(weightedQualityScore * 10) / 10,
    },
    margins: {
      grossMargin: weightedGrossMargin != null ? Math.round(weightedGrossMargin * 100) / 100 : null,
      operatingMargin:
        weightedOperatingMargin != null ? Math.round(weightedOperatingMargin * 100) / 100 : null,
      netMargin: weightedNetMargin != null ? Math.round(weightedNetMargin * 100) / 100 : null,
    },
    returnsOnCapital: {
      roic: weightedRoic != null ? Math.round(weightedRoic * 100) / 100 : null,
      roce: weightedRoce != null ? Math.round(weightedRoce * 100) / 100 : null,
      roe: weightedRoe != null ? Math.round(weightedRoe * 100) / 100 : null,
    },
    growth: {
      revenueGrowth: weightedRevGrowth != null ? Math.round(weightedRevGrowth * 100) / 100 : null,
      epsGrowth: weightedEpsGrowth != null ? Math.round(weightedEpsGrowth * 100) / 100 : null,
      fcfGrowth: weightedFcfGrowth != null ? Math.round(weightedFcfGrowth * 100) / 100 : null,
    },
    health: {
      netDebtToEbitda:
        weightedNetDebtToEbitda != null ? Math.round(weightedNetDebtToEbitda * 100) / 100 : null,
      interestCoverage:
        weightedInterestCoverage != null ? Math.round(weightedInterestCoverage * 100) / 100 : null,
      goodwillToAssets:
        weightedGoodwillToAssets != null ? Math.round(weightedGoodwillToAssets * 100) / 100 : null,
    },
    valuation: {
      peRatio: weightedPeRatio != null ? Math.round(weightedPeRatio * 100) / 100 : null,
      forwardPE: weightedForwardPe != null ? Math.round(weightedForwardPe * 100) / 100 : null,
      peOnCost: weightedPeOnCost != null ? Math.round(weightedPeOnCost * 100) / 100 : null,
      pegRatio: weightedPegRatio != null ? Math.round(weightedPegRatio * 100) / 100 : null,
      pfcfRatio: weightedPfcfRatio != null ? Math.round(weightedPfcfRatio * 100) / 100 : null,
      pfcfOnCost: weightedPfcfOnCost != null ? Math.round(weightedPfcfOnCost * 100) / 100 : null,
      evToEbitda: weightedEvToEbitda != null ? Math.round(weightedEvToEbitda * 100) / 100 : null,
    },
  };
}
