import type { Holding, Asset, Account } from '@wealthfolio/addon-sdk';

export interface AccountScope {
  type: 'all' | 'group' | 'account' | 'portfolio';
  id?: string;
  label?: string;
}

export type PortfolioScope = AccountScope;

export interface RawStockFinancials {
  symbol: string;
  name?: string;
  currency?: string;
  marketCap?: number;
  grossMargins?: number;
  operatingMargins?: number;
  profitMargins?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  roic?: number;
  roce?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  fcfGrowth?: number;
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  priceToBook?: number;
  priceToSales?: number;
  enterpriseToEbitda?: number;
  priceToFreeCashFlow?: number;
  netDebtToEbitda?: number;
  interestCoverage?: number;
  goodwillToAssets?: number;
  totalDebt?: number;
  totalCash?: number;
  ebitda?: number;
  freeCashflow?: number;
  totalRevenue?: number;
  operatingCashflow?: number;
}

export interface StockHoldingMetric {
  id: string;
  assetId?: string;
  symbol: string;
  name: string;
  currency: string;
  exchangeMic?: string;
  instrumentType?: string;
  shares: number;
  price: number;
  marketValue: number;
  costBasis: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  weight: number; // in %
  isStockOnly: boolean;

  // General & Score
  marketCap: number; // in millions
  qualityScore: number; // Note Q (0-20)

  // Margins (in %)
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;

  // Returns on capital (in %)
  roic: number | null;
  roce: number | null;
  roe: number | null;

  // Growth (in %)
  revenueGrowth: number | null;
  epsGrowth: number | null;
  fcfGrowth: number | null;

  // Financial Health
  netDebtToEbitda: number | null;
  interestCoverage: number | null;
  goodwillToAssets: number | null; // in %

  // Valuation
  peRatio: number | null;
  forwardPE: number | null;
  peOnCost: number | null;
  pegRatio: number | null;
  pfcfRatio: number | null;
  pfcfOnCost: number | null;
  evToEbitda: number | null;
}

export interface PortfolioCategoryMetrics {
  general: {
    stockCount: number;
    top5Concentration: number; // %
    top10Concentration: number; // %
    weightedMarketCap: number; // in Millions
    qualityScore: number; // Note Q (0-20)
  };
  margins: {
    grossMargin: number | null; // %
    operatingMargin: number | null; // %
    netMargin: number | null; // %
  };
  returnsOnCapital: {
    roic: number | null; // %
    roce: number | null; // %
    roe: number | null; // %
  };
  growth: {
    revenueGrowth: number | null; // %
    epsGrowth: number | null; // %
    fcfGrowth: number | null; // %
  };
  health: {
    netDebtToEbitda: number | null; // ratio
    interestCoverage: number | null; // ratio
    goodwillToAssets: number | null; // %
  };
  valuation: {
    peRatio: number | null;
    forwardPE: number | null;
    peOnCost: number | null;
    pegRatio: number | null;
    pfcfRatio: number | null;
    pfcfOnCost: number | null;
    evToEbitda: number | null;
  };
}

export interface PortfolioAggregatedMetrics extends PortfolioCategoryMetrics {
  scope: AccountScope;
  baseCurrency: string;
  totalMarketValue: number;
  totalCostBasis: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPct: number;
  holdings: StockHoldingMetric[];
  top5Holdings: StockHoldingMetric[];
  top10Holdings: StockHoldingMetric[];
  nonStockHoldingsCount: number;
}
