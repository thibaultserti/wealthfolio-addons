import type { ActivityDetails, ReturnData } from '@wealthfolio/addon-sdk';
import type { DatedCashFlow, PerformanceMetrics, DateRange } from '../types';
import { filterSeriesByDateRange } from './correlation-utils';

/**
 * Computes the annualized return from a percentage return and a duration/openDate.
 *
 * Formula: (1 + returnPct) ^ (365.25 / days) - 1
 */
export function computeAnnualizedReturn(
  returnPct: number | null | undefined,
  openDate: string | Date | null | undefined,
  endDate?: string | Date | null,
): number | null {
  if (returnPct == null || openDate == null) return null;

  const openMs = typeof openDate === 'string' ? new Date(openDate).getTime() : openDate.getTime();
  if (Number.isNaN(openMs)) return null;

  const endMs = endDate
    ? typeof endDate === 'string'
      ? new Date(endDate).getTime()
      : endDate.getTime()
    : Date.now();
  if (Number.isNaN(endMs)) return null;

  const days = (endMs - openMs) / (1000 * 60 * 60 * 24);
  if (days < 2) return null;

  const years = days / 365.25;
  const base = 1 + returnPct;

  // Protect against negative base (total loss > 100%) — undefined for power
  if (base <= 0) return null;

  return Math.pow(base, 1 / years) - 1;
}

/**
 * Standard XIRR solver for dated cash flows using bisection.
 * Returns the annualized Internal Rate of Return (IRR / TRI).
 */
export function computeXirr(cashFlows: DatedCashFlow[]): number | null {
  if (!cashFlows || cashFlows.length < 2) return null;

  const validFlows = cashFlows
    .map((cf) => ({
      timestamp: typeof cf.date === 'string' ? new Date(cf.date).getTime() : cf.date.getTime(),
      amount: Number(cf.amount),
    }))
    .filter((cf) => !Number.isNaN(cf.timestamp) && Number.isFinite(cf.amount) && cf.amount !== 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (validFlows.length < 2) return null;

  const hasPositive = validFlows.some((cf) => cf.amount > 0);
  const hasNegative = validFlows.some((cf) => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const originTime = validFlows[0].timestamp;
  const lastTime = validFlows[validFlows.length - 1].timestamp;
  const totalDays = (lastTime - originTime) / (1000 * 60 * 60 * 24);

  // If period is under 2 days, IRR cannot be meaningfully computed
  if (totalDays < 2) return null;

  // Net Present Value function at annual rate `r`
  const npv = (rate: number): number => {
    let sum = 0;
    for (const cf of validFlows) {
      const fractionOfYear = (cf.timestamp - originTime) / (1000 * 60 * 60 * 24 * 365.25);
      const discount = Math.pow(1 + rate, fractionOfYear);
      if (!Number.isFinite(discount) || discount === 0) return NaN;
      sum += cf.amount / discount;
    }
    return sum;
  };

  // Bisection method bounds
  let low = -0.9999;
  let high = 50.0; // up to 5000% annual return
  let npvLow = npv(low);
  const npvHigh = npv(high);

  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh)) return null;

  // If no root in standard interval, expand search upward
  if (Math.sign(npvLow) === Math.sign(npvHigh)) {
    high = 200.0;
    if (Math.sign(npvLow) === Math.sign(npv(high))) {
      return null;
    }
  }

  const maxIter = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);

    if (!Number.isFinite(npvMid) || Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) {
      return mid;
    }

    if (Math.sign(npvLow) === Math.sign(npvMid)) {
      low = mid;
      npvLow = npvMid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

/**
 * Computes TWR and IRR metrics for an asset following standard financial rules:
 * - Periods under 1 year (365 days) are shown as selected-period returns.
 * - Periods of 1 year or longer are shown annualized.
 */
export function computeHoldingPerformance({
  totalReturnPct,
  openDate,
  endDate,
  cashFlows,
}: {
  totalReturnPct: number | null | undefined;
  openDate: string | Date | null | undefined;
  endDate?: string | Date | null;
  cashFlows?: DatedCashFlow[];
}): PerformanceMetrics {
  const openMs = openDate
    ? typeof openDate === 'string'
      ? new Date(openDate).getTime()
      : openDate.getTime()
    : NaN;

  const endMs = endDate
    ? typeof endDate === 'string'
      ? new Date(endDate).getTime()
      : endDate.getTime()
    : Date.now();

  const daysHeld =
    !Number.isNaN(openMs) && !Number.isNaN(endMs) && endMs >= openMs
      ? (endMs - openMs) / (1000 * 60 * 60 * 24)
      : null;

  const isAnnualized = daysHeld != null && daysHeld >= 365;

  const twr = totalReturnPct != null && Number.isFinite(totalReturnPct) ? totalReturnPct : null;
  const annualizedTwr = computeAnnualizedReturn(twr, openDate, endDate);
  const displayTwr = isAnnualized && annualizedTwr != null ? annualizedTwr : twr;
  const twrLabelKey = isAnnualized ? 'annualized_twr' : 'twr';

  // Calculate IRR (TRI / Money-weighted)
  let calculatedAnnualizedIrr: number | null = null;
  if (cashFlows && cashFlows.length >= 2) {
    calculatedAnnualizedIrr = computeXirr(cashFlows);
  }

  const annualizedIrr = calculatedAnnualizedIrr ?? annualizedTwr;

  let periodIrr: number | null = null;
  if (annualizedIrr != null && daysHeld != null && daysHeld >= 2) {
    const years = daysHeld / 365.25;
    const base = 1 + annualizedIrr;
    if (base > 0) {
      periodIrr = Math.pow(base, years) - 1;
    }
  } else {
    periodIrr = twr;
  }

  const displayIrr = isAnnualized && annualizedIrr != null ? annualizedIrr : (periodIrr ?? twr);
  const irrLabelKey = isAnnualized ? 'annualized_irr' : 'irr';

  return {
    twr,
    annualizedTwr,
    displayTwr,
    twrLabelKey,
    irr: periodIrr,
    annualizedIrr,
    displayIrr,
    irrLabelKey,
    daysHeld,
    isAnnualized,
  };
}

function toIsoDateString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val.split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).split('T')[0];
}

/**
 * Computes period-accurate performance metrics (TWR, IRR, PnL) taking into account the selected DateRange.
 */
export function computeAssetPeriodPerformance({
  quotesSeries,
  activities,
  currentMarketValue,
  currentCostBasis,
  allTimeTotalReturnPct,
  openDate,
  dateRange,
}: {
  quotesSeries: ReturnData[];
  activities: ActivityDetails[];
  currentMarketValue: number;
  currentCostBasis: number;
  allTimeTotalReturnPct: number | null;
  openDate?: string | Date | null;
  dateRange?: DateRange;
}): {
  perf: PerformanceMetrics;
  periodGain: number;
  periodGainPercent: number | null;
} {
  const now = new Date();
  const startDate = dateRange?.from
    ? new Date(dateRange.from)
    : openDate
      ? new Date(openDate)
      : null;
  const endDate = dateRange?.to ? new Date(dateRange.to) : now;

  const startIso = startDate ? toIsoDateString(startDate) : null;
  const endIso = endDate ? toIsoDateString(endDate) : null;

  // Filter quote series for the timeframe
  const periodQuotes = filterSeriesByDateRange(quotesSeries, dateRange);

  let periodTwrPct: number | null = null;
  if (periodQuotes.length >= 2) {
    const firstVal = periodQuotes[0].value;
    const lastVal = periodQuotes[periodQuotes.length - 1].value;
    if (firstVal > 0 && lastVal > 0) {
      periodTwrPct = (lastVal - firstVal) / firstVal;
    }
  } else if (!dateRange) {
    periodTwrPct = allTimeTotalReturnPct;
  }

  // Construct cash flows strictly inside the chosen period
  const cashFlows: DatedCashFlow[] = [];

  // Determine initial position value at startDate
  if (startIso && periodQuotes.length > 0) {
    const startPrice = periodQuotes[0].value;
    let qtyAtStart = 0;
    for (const act of activities) {
      const actDateIso = toIsoDateString(act.date);
      if (actDateIso && actDateIso < startIso) {
        const actType = String(act.activityType).toUpperCase();
        if (actType === 'BUY' || actType === 'TRANSFER_IN') {
          qtyAtStart += Number(act.quantity ?? 0);
        } else if (actType === 'SELL' || actType === 'TRANSFER_OUT') {
          qtyAtStart -= Number(act.quantity ?? 0);
        }
      }
    }

    if (qtyAtStart > 0 && startPrice > 0) {
      cashFlows.push({
        date: startDate!,
        amount: -(qtyAtStart * startPrice),
      });
    }
  }

  // Intermediate activities in this period
  for (const act of activities) {
    const actDateIso = toIsoDateString(act.date);
    if (startIso && actDateIso < startIso) continue;
    if (endIso && actDateIso > endIso) continue;

    const actType = String(act.activityType).toUpperCase();
    if (actType === 'BUY' || actType === 'TRANSFER_IN') {
      const cost =
        Number(act.amount ?? 0) > 0
          ? Number(act.amount)
          : Number(act.unitPrice ?? 0) * Number(act.quantity ?? 0) + Number(act.fee ?? 0);
      if (cost > 0) cashFlows.push({ date: act.date, amount: -cost });
    } else if (actType === 'SELL' || actType === 'TRANSFER_OUT') {
      const proceeds =
        Number(act.amount ?? 0) > 0
          ? Number(act.amount)
          : Number(act.unitPrice ?? 0) * Number(act.quantity ?? 0) - Number(act.fee ?? 0);
      if (proceeds > 0) cashFlows.push({ date: act.date, amount: proceeds });
    } else if (actType === 'DIVIDEND' || actType === 'INTEREST') {
      const inc = Number(act.amount ?? 0);
      if (inc > 0) cashFlows.push({ date: act.date, amount: inc });
    }
  }

  // Fallback if no initial position and no activities
  if (cashFlows.length === 0 && currentCostBasis > 0) {
    cashFlows.push({
      date: startDate || openDate || new Date(now.getTime() - 365 * 24 * 3600 * 1000),
      amount: -currentCostBasis,
    });
  }

  // Terminal cash flow at end of period
  if (currentMarketValue > 0) {
    cashFlows.push({
      date: endDate,
      amount: currentMarketValue,
    });
  }

  const perf = computeHoldingPerformance({
    totalReturnPct: periodTwrPct ?? allTimeTotalReturnPct,
    openDate: startDate || openDate,
    endDate,
    cashFlows: cashFlows.length >= 2 ? cashFlows : undefined,
  });

  // Calculate period PnL
  let periodGain = 0;
  if (periodTwrPct != null && currentMarketValue > 0) {
    periodGain = currentMarketValue * (periodTwrPct / (1 + periodTwrPct));
  } else {
    periodGain = currentMarketValue - currentCostBasis;
  }

  const periodGainPercent =
    periodTwrPct ??
    (currentCostBasis > 0 ? (currentMarketValue - currentCostBasis) / currentCostBasis : null);

  return {
    perf,
    periodGain,
    periodGainPercent,
  };
}
