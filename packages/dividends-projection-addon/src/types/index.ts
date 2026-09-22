export type DividendFrequency =
  'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'irregular' | 'none';

export interface AccountScope {
  type: 'all' | 'group' | 'account' | 'portfolio';
  id?: string;
  label?: string;
}

export type PortfolioScope = AccountScope;

export interface MonthPayoutItem {
  holdingId: string;
  symbol: string;
  name: string;
  exchangeMic?: string;
  instrumentType?: string;
  shares: number;
  dividendPerShare: number;
  amountLocal: number;
  amountBase: number;
  currency: string;
  estimatedDate: string; // ISO date format YYYY-MM-DD
  frequency: DividendFrequency;
  percentOfMonthTotal: number;
}

export interface MonthProjection {
  key: string; // YYYY-MM
  year: number;
  month: number; // 1-12
  monthLabel: string; // "Jan 2026", etc.
  shortMonthLabel: string; // "Jan", "Feb"
  totalAmountBase: number;
  payoutCount: number;
  items: MonthPayoutItem[];
}

export interface HoldingDividendInfo {
  holdingId: string;
  assetId?: string;
  symbol: string;
  name: string;
  exchangeMic?: string;
  instrumentType?: string;
  shares: number;
  currentPrice: number;
  marketValue: number; // in base currency
  marketValueLocal: number;
  costBasis: number; // in base currency
  costBasisLocal: number;
  currency: string; // local currency
  baseCurrency: string;
  fxRate: number; // local to base
  annualDividendPerShare: number; // in local currency
  annualDividendLocal: number;
  annualDividendBase: number;
  dividendYieldPct: number; // % (annualDividendBase / marketValue * 100)
  yieldOnCostPct: number; // % (annualDividendBase / costBasis * 100)
  frequency: DividendFrequency;
  payoutMonths: number[]; // e.g. [3, 6, 9, 12]
  growth12MPct: number | null; // YoY %
  growth5YPct: number | null; // 5Y CAGR %
  isPayer: boolean;
  weightInIncomePct: number; // % of total portfolio dividend income
  weightInPortfolioPct: number; // % of total portfolio value
}

export interface DividendsSummary {
  baseCurrency: string;
  totalMarketValue: number;
  totalCostBasis: number;
  projectedAnnualIncome: number;
  projectedMonthlyAverage: number;
  dividendYieldPct: number;
  yieldOnCostPct: number;
  growth12MPct: number | null;
  growth5YPct: number | null;
  totalHoldingsCount: number;
  payingHoldingsCount: number;
  monthlyProjections: MonthProjection[];
  holdings: HoldingDividendInfo[];
  historicalYearsData?: {
    year: number;
    amount: number;
    growthPct: number | null;
  }[];
}
