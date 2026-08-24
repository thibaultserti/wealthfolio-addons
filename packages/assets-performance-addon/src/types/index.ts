import type { ReturnData } from '@wealthfolio/addon-sdk';

export interface PortfolioScope {
  type: 'all' | 'group' | 'account' | 'portfolio';
  id?: string;
  label?: string;
}

export interface DatedCashFlow {
  date: string | Date;
  amount: number;
}

export interface PerformanceMetrics {
  twr: number | null;
  annualizedTwr: number | null;
  displayTwr: number | null;
  twrLabelKey: 'twr' | 'annualized_twr';

  irr: number | null;
  annualizedIrr: number | null;
  displayIrr: number | null;
  irrLabelKey: 'irr' | 'annualized_irr';

  daysHeld: number | null;
  isAnnualized: boolean;
}

export interface AssetPerformanceItem {
  id: string; // asset id or holding id
  assetId: string;
  symbol: string;
  name: string;
  currency: string;
  assetClass?: string;
  quantity: number;
  marketPrice: number;
  marketValue: number; // in base currency
  marketValueLocal: number;
  costBasis: number; // in base currency
  costBasisLocal: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number | null;
  realizedPnl: number;
  totalGain: number;
  totalGainPercent: number | null;
  totalReturn: number;
  totalReturnPercent: number | null;
  weight: number; // percentage of current portfolio value (0-100)
  openDate?: string | Date | null;
  cashFlows: DatedCashFlow[];
  perf: PerformanceMetrics;
  quotesSeries: ReturnData[]; // Historical daily return or price points
  riskMetrics?: AssetRiskMetrics;
}

export interface AssetRiskMetrics {
  alpha: number | null; // vs benchmark
  beta: number | null; // vs benchmark
  correlationBenchmark: number | null;
  correlationPortfolio: number | null;
  volatility: number | null; // annualized volatility
  sharpeRatio: number | null;
  maxDrawdown: number | null;
}

export interface CorrelationCell {
  assetAId: string;
  assetASymbol: string;
  assetBId: string;
  assetBSymbol: string;
  correlation: number;
  commonPoints: number;
}

export interface CorrelationMatrixData {
  symbols: string[];
  names: Record<string, string>;
  matrix: number[][]; // N x N
  pairs: CorrelationCell[];
}

export interface BenchmarkPreset {
  id: string;
  symbol: string;
  name: string;
  description: string;
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export type ComparisonTimeframe = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | 'ALL';
