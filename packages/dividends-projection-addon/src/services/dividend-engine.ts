import type { DividendEvent, Holding, ActivityDetails } from '@wealthfolio/addon-sdk';
import type {
  DividendFrequency,
  DividendsSummary,
  HoldingDividendInfo,
  MonthPayoutItem,
  MonthProjection,
} from '../types';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Detect dividend payment frequency and expected payout months from historical events.
 */
export function analyzeDividendSchedule(
  events: DividendEvent[],
  fallbackActivityEvents?: { date: Date | string; amountPerShare: number }[],
): {
  frequency: DividendFrequency;
  payoutMonths: number[];
  latestPayoutPerShare: number;
  annualDividendPerShare: number;
  growth12MPct: number | null;
  growth5YPct: number | null;
} {
  let combinedEvents: DividendEvent[] = events && events.length > 0 ? [...events] : [];

  // Fallback to activity history if market events are missing
  if (combinedEvents.length === 0 && fallbackActivityEvents && fallbackActivityEvents.length > 0) {
    combinedEvents = fallbackActivityEvents.map((a) => ({
      amount: a.amountPerShare,
      date: Math.floor(new Date(a.date).getTime() / 1000),
    }));
  }

  if (!combinedEvents || combinedEvents.length === 0) {
    return {
      frequency: 'none',
      payoutMonths: [],
      latestPayoutPerShare: 0,
      annualDividendPerShare: 0,
      growth12MPct: null,
      growth5YPct: null,
    };
  }

  // Sort events chronologically (oldest to newest)
  const sorted = [...combinedEvents].sort((a, b) => a.date - b.date);
  const nowSec = Math.floor(Date.now() / 1000);
  const oneYearSec = 365.25 * 86400;

  // Filter events in the last 12 months
  const last12mEvents = sorted.filter(
    (e) => e.date >= nowSec - oneYearSec && e.date <= nowSec + 30 * 86400,
  );
  const prev12mEvents = sorted.filter(
    (e) => e.date >= nowSec - 2 * oneYearSec && e.date < nowSec - oneYearSec,
  );

  const latestEvent = sorted[sorted.length - 1];
  const latestPayout = latestEvent ? latestEvent.amount : 0;

  // Group events and calculate intervals
  let frequency: DividendFrequency = 'annual';

  if (sorted.length >= 2) {
    const intervalsInDays: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diffDays = (sorted[i].date - sorted[i - 1].date) / 86400;
      if (diffDays > 0) {
        intervalsInDays.push(diffDays);
      }
    }

    const recentIntervals = intervalsInDays.slice(-6);
    const avgInterval =
      recentIntervals.length > 0
        ? recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length
        : 365;

    if (avgInterval <= 45 || last12mEvents.length >= 9) {
      frequency = 'monthly';
    } else if (avgInterval <= 125 || (last12mEvents.length >= 3 && last12mEvents.length <= 5)) {
      frequency = 'quarterly';
    } else if (avgInterval <= 245 || last12mEvents.length === 2) {
      frequency = 'semi-annual';
    } else {
      frequency = 'annual';
    }
  } else {
    frequency = 'annual';
  }

  // Calculate annual rate per share
  let annualDividendPerShare = 0;
  if (frequency === 'annual') {
    // For annual stocks, latest annual distribution is the annual rate
    annualDividendPerShare = latestPayout;
  } else if (frequency === 'semi-annual') {
    // For semi-annual stocks (e.g. interim + final), sum the 2 payouts from trailing 12m if available
    if (last12mEvents.length >= 2) {
      annualDividendPerShare = last12mEvents.slice(-2).reduce((acc, e) => acc + e.amount, 0);
    } else if (
      sorted.length >= 2 &&
      (sorted[sorted.length - 1].date - sorted[sorted.length - 2].date) / 86400 <= 245
    ) {
      annualDividendPerShare = sorted[sorted.length - 1].amount + sorted[sorted.length - 2].amount;
    } else {
      annualDividendPerShare = latestPayout * 2;
    }
  } else if (frequency === 'quarterly') {
    // For quarterly stocks, forward annual rate is latest quarterly payout * 4
    annualDividendPerShare = latestPayout * 4;
  } else if (frequency === 'monthly') {
    // For monthly stocks, forward annual rate is latest monthly payout * 12
    annualDividendPerShare = latestPayout * 12;
  } else {
    annualDividendPerShare = latestPayout;
  }

  // Extract payout months (1-12)
  const monthSet = new Set<number>();
  // Use events from the last 2 years to discover payout months
  const recentEvents = sorted.filter((e) => e.date >= nowSec - 2 * oneYearSec);
  const eventsForMonths = recentEvents.length > 0 ? recentEvents : sorted.slice(-4);

  eventsForMonths.forEach((e) => {
    const d = new Date(e.date * 1000);
    monthSet.add(d.getMonth() + 1);
  });

  if (frequency === 'monthly') {
    for (let m = 1; m <= 12; m++) {
      monthSet.add(m);
    }
  } else if (frequency === 'quarterly') {
    if (monthSet.size === 0) {
      [3, 6, 9, 12].forEach((m) => monthSet.add(m));
    } else if (monthSet.size < 4) {
      const baseMonth = Array.from(monthSet)[0];
      for (let i = 0; i < 4; i++) {
        const m = ((baseMonth - 1 + i * 3) % 12) + 1;
        monthSet.add(m);
      }
    }
  } else if (frequency === 'semi-annual') {
    if (monthSet.size === 0) {
      [5, 11].forEach((m) => monthSet.add(m));
    } else if (monthSet.size === 1) {
      const baseMonth = Array.from(monthSet)[0];
      monthSet.add(((baseMonth - 1 + 6) % 12) + 1);
    }
  } else if (frequency === 'annual') {
    if (monthSet.size === 0) {
      // Default to May if unknown
      monthSet.add(5);
    } else if (monthSet.size > 1) {
      // Keep the most recent payout month for annual stocks
      const latestMonth = new Date(latestEvent.date * 1000).getMonth() + 1;
      monthSet.clear();
      monthSet.add(latestMonth);
    }
  }

  const payoutMonths = Array.from(monthSet).sort((a, b) => a - b);

  // 12-Month YoY Growth (per share)
  let growth12MPct: number | null = null;
  if (sorted.length >= 2) {
    const latest = sorted[sorted.length - 1];
    // Find prior year payment (300 to 430 days prior to latest event)
    const priorYearEvent = sorted
      .slice(0, -1)
      .reverse()
      .find((e) => latest.date - e.date >= 300 * 86400 && latest.date - e.date <= 430 * 86400);

    if (priorYearEvent && priorYearEvent.amount > 0 && latest.amount > 0) {
      const rate = ((latest.amount - priorYearEvent.amount) / priorYearEvent.amount) * 100;
      if (Math.abs(rate) <= 100) {
        growth12MPct = rate;
      }
    } else {
      const prev = sorted[sorted.length - 2];
      if (prev && prev.amount > 0 && latest.amount > 0 && latest.date - prev.date >= 60 * 86400) {
        const rate = ((latest.amount - prev.amount) / prev.amount) * 100;
        if (Math.abs(rate) <= 100) {
          growth12MPct = rate;
        }
      }
    }
  }

  // 5-Year CAGR Growth (per share)
  let growth5YPct: number | null = null;
  if (sorted.length >= 2) {
    const latest = sorted[sorted.length - 1];
    const fiveYearEvent = sorted.find(
      (e) => latest.date - e.date >= 4 * oneYearSec && latest.date - e.date <= 6 * oneYearSec,
    );

    if (fiveYearEvent && fiveYearEvent.amount > 0 && latest.amount > 0) {
      const yearsDiff = (latest.date - fiveYearEvent.date) / oneYearSec;
      const cagr = (Math.pow(latest.amount / fiveYearEvent.amount, 1 / yearsDiff) - 1) * 100;
      if (Math.abs(cagr) <= 100) {
        growth5YPct = cagr;
      }
    } else {
      const oldestMultiYearEvent = sorted.find((e) => latest.date - e.date >= 2 * oneYearSec);
      if (oldestMultiYearEvent && oldestMultiYearEvent.amount > 0 && latest.amount > 0) {
        const yearsDiff = (latest.date - oldestMultiYearEvent.date) / oneYearSec;
        if (yearsDiff >= 1.8) {
          const cagr =
            (Math.pow(latest.amount / oldestMultiYearEvent.amount, 1 / yearsDiff) - 1) * 100;
          if (Math.abs(cagr) <= 100) {
            growth5YPct = cagr;
          }
        }
      }
    }
  }

  return {
    frequency,
    payoutMonths,
    latestPayoutPerShare: latestPayout,
    annualDividendPerShare,
    growth12MPct,
    growth5YPct,
  };
}

/**
 * Generate 12-month rolling projection calendar from holdings dividend info.
 */
export function generateMonthlyProjections(
  holdings: HoldingDividendInfo[],
  startDate: Date = new Date(),
): MonthProjection[] {
  const projections: MonthProjection[] = [];
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth(); // 0-11

  for (let i = 0; i < 12; i++) {
    const curDate = new Date(startYear, startMonth + i, 1);
    const year = curDate.getFullYear();
    const month = curDate.getMonth() + 1; // 1-12
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
    const shortMonthLabel = MONTH_SHORT_NAMES[month - 1];

    const items: MonthPayoutItem[] = [];

    for (const h of holdings) {
      if (!h.isPayer || h.shares <= 0) continue;

      // Check if this holding pays in this month
      if (h.payoutMonths.includes(month)) {
        // Calculate payout for this cycle
        let payoutPerShare = 0;
        if (h.frequency === 'monthly') {
          payoutPerShare = h.annualDividendPerShare / 12;
        } else if (h.frequency === 'quarterly') {
          payoutPerShare = h.annualDividendPerShare / 4;
        } else if (h.frequency === 'semi-annual') {
          payoutPerShare = h.annualDividendPerShare / 2;
        } else {
          // Annual dividend distributes full amount in its payout month
          payoutPerShare = h.annualDividendPerShare;
        }

        const amountLocal = h.shares * payoutPerShare;
        const amountBase = amountLocal * (h.fxRate || 1);

        items.push({
          holdingId: h.holdingId,
          symbol: h.symbol,
          name: h.name,
          exchangeMic: h.exchangeMic,
          instrumentType: h.instrumentType,
          shares: h.shares,
          dividendPerShare: payoutPerShare,
          amountLocal,
          amountBase,
          currency: h.currency,
          estimatedDate: `${year}-${String(month).padStart(2, '0')}-15`,
          frequency: h.frequency,
          percentOfMonthTotal: 0, // calculated below
        });
      }
    }

    const totalAmountBase = items.reduce((acc, it) => acc + it.amountBase, 0);

    // Compute percent contribution of each holding to this month
    items.forEach((item) => {
      item.percentOfMonthTotal =
        totalAmountBase > 0 ? (item.amountBase / totalAmountBase) * 100 : 0;
    });

    // Sort items by amount descending
    items.sort((a, b) => b.amountBase - a.amountBase);

    projections.push({
      key,
      year,
      month,
      monthLabel,
      shortMonthLabel,
      totalAmountBase,
      payoutCount: items.length,
      items,
    });
  }

  return projections;
}

/**
 * Detect if a holding is a Cash / Fiat currency balance.
 */
export function isCash(holding: Holding): boolean {
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
 * Detect if a holding is an ETF, Index Fund, or Mutual Fund rather than an individual stock.
 */
export function isEtfOrFund(holding: Holding): boolean {
  if (isCash(holding)) return true;
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
  const quoteType = metaProfile?.quoteType?.toUpperCase();
  if (quoteType === 'ETF' || quoteType === 'MUTUALFUND' || quoteType === 'INDEX') {
    return true;
  }

  const name = (holding.instrument?.name || '').toUpperCase();
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
    name.includes('WISDOMTREE')
  ) {
    return true;
  }

  return false;
}

/**
 * Process holdings, dividend events, and activities into a comprehensive dividend summary.
 */
export function calculateDividendsSummary({
  holdings,
  dividendEventsBySymbol,
  activities = [],
  baseCurrency = 'USD',
}: {
  holdings: Holding[];
  dividendEventsBySymbol: Record<string, DividendEvent[]>;
  activities?: ActivityDetails[];
  baseCurrency?: string;
}): DividendsSummary {
  const processedHoldings: HoldingDividendInfo[] = [];

  let totalMarketValue = 0;
  let totalCostBasis = 0;

  // Index activities by symbol and assetId for fallback
  const divActivitiesBySymbol: Record<string, { date: Date | string; amountPerShare: number }[]> =
    {};
  activities
    .filter((a) => a.activityType === 'DIVIDEND')
    .forEach((a) => {
      const sym = a.assetSymbol;
      const aId = a.assetId;
      const qty = Number(a.quantity) || 1;
      const amt = Number(a.amount) || 0;
      const unitPrice = Number(a.unitPrice) || (qty > 0 ? amt / qty : 0);
      const item = {
        date: a.date,
        amountPerShare: unitPrice > 0 ? unitPrice : amt,
      };

      if (sym) {
        if (!divActivitiesBySymbol[sym]) divActivitiesBySymbol[sym] = [];
        divActivitiesBySymbol[sym].push(item);
      }
      if (aId) {
        if (!divActivitiesBySymbol[aId]) divActivitiesBySymbol[aId] = [];
        divActivitiesBySymbol[aId].push(item);
      }
    });

  for (const h of holdings) {
    const symbol = h.instrument?.symbol ?? '';
    const assetId = h.instrument?.id ?? '';
    const holdingId = h.id ?? '';
    const name = h.instrument?.name || symbol || 'Unnamed Asset';
    const quantity = Number(h.quantity) || 0;
    if (quantity <= 0) continue;

    const marketValBase = Number(h.marketValue?.base) || 0;
    const marketValLocal = Number(h.marketValue?.local) || 0;
    const costBasisBase = Number(h.costBasis?.base) || 0;
    const costBasisLocal = Number(h.costBasis?.local) || 0;
    const localCcy = h.localCurrency || baseCurrency;
    const fxRate = Number(h.fxRate) || (marketValLocal > 0 ? marketValBase / marketValLocal : 1);

    totalMarketValue += marketValBase;
    totalCostBasis += costBasisBase;

    // If asset is an ETF/Fund, ignore dividends (only calculate for individual stocks)
    const isFund = isEtfOrFund(h);

    const events = isFund
      ? []
      : dividendEventsBySymbol[holdingId] ||
        (assetId ? dividendEventsBySymbol[assetId] : undefined) ||
        dividendEventsBySymbol[symbol] ||
        dividendEventsBySymbol[`${symbol}.PA`] ||
        [];
    const fallbackActivities = isFund
      ? []
      : (assetId ? divActivitiesBySymbol[assetId] : undefined) ||
        divActivitiesBySymbol[symbol] ||
        divActivitiesBySymbol[`${symbol}.PA`] ||
        [];
    const schedule = analyzeDividendSchedule(events, fallbackActivities);

    const isPayer = schedule.annualDividendPerShare > 0;
    const annualDivLocal = quantity * schedule.annualDividendPerShare;
    const annualDivBase = annualDivLocal * fxRate;

    const divYieldPct = marketValBase > 0 ? (annualDivBase / marketValBase) * 100 : 0;
    const yieldOnCostPct = costBasisBase > 0 ? (annualDivBase / costBasisBase) * 100 : divYieldPct;

    const currentPrice = Number(h.price) || (quantity > 0 ? marketValLocal / quantity : 0);

    processedHoldings.push({
      holdingId: h.id,
      assetId: h.instrument?.id,
      symbol,
      name,
      exchangeMic: (h.instrument as { exchangeMic?: string })?.exchangeMic ?? undefined,
      instrumentType: h.assetKind ?? undefined,
      shares: quantity,
      currentPrice,
      marketValue: marketValBase,
      marketValueLocal: marketValLocal,
      costBasis: costBasisBase,
      costBasisLocal,
      currency: localCcy,
      baseCurrency,
      fxRate,
      annualDividendPerShare: schedule.annualDividendPerShare,
      annualDividendLocal: annualDivLocal,
      annualDividendBase: annualDivBase,
      dividendYieldPct: divYieldPct,
      yieldOnCostPct,
      frequency: schedule.frequency,
      payoutMonths: schedule.payoutMonths,
      growth12MPct: schedule.growth12MPct,
      growth5YPct: schedule.growth5YPct,
      isPayer,
      weightInIncomePct: 0,
      weightInPortfolioPct: 0,
    });
  }

  const projectedAnnualIncome = processedHoldings.reduce((acc, h) => acc + h.annualDividendBase, 0);
  const projectedMonthlyAverage = projectedAnnualIncome / 12;

  // Compute portfolio weights
  processedHoldings.forEach((h) => {
    h.weightInIncomePct =
      projectedAnnualIncome > 0 ? (h.annualDividendBase / projectedAnnualIncome) * 100 : 0;
    h.weightInPortfolioPct = totalMarketValue > 0 ? (h.marketValue / totalMarketValue) * 100 : 0;
  });

  // Sort holdings by annual dividend payout descending
  processedHoldings.sort((a, b) => b.annualDividendBase - a.annualDividendBase);

  // Calculate portfolio dividend yield and yield on cost
  const dividendYieldPct =
    totalMarketValue > 0 ? (projectedAnnualIncome / totalMarketValue) * 100 : 0;
  const yieldOnCostPct = totalCostBasis > 0 ? (projectedAnnualIncome / totalCostBasis) * 100 : 0;

  // Generate 12-month projections
  const monthlyProjections = generateMonthlyProjections(processedHoldings);

  // Compute overall historical dividend growth from activities (or holding aggregates)
  const { growth12MPct, growth5YPct, historicalYearsData } = calculatePortfolioDividendGrowth(
    activities,
    processedHoldings,
  );

  const payingHoldingsCount = processedHoldings.filter((h) => h.isPayer).length;

  return {
    baseCurrency,
    totalMarketValue,
    totalCostBasis,
    projectedAnnualIncome,
    projectedMonthlyAverage,
    dividendYieldPct,
    yieldOnCostPct,
    growth12MPct,
    growth5YPct,
    totalHoldingsCount: processedHoldings.length,
    payingHoldingsCount,
    monthlyProjections,
    holdings: processedHoldings,
    historicalYearsData,
  };
}

/**
 * Calculate historical dividend growth rates across the whole portfolio using transactions.
 */
function calculatePortfolioDividendGrowth(
  activities: ActivityDetails[],
  holdings: HoldingDividendInfo[],
): {
  growth12MPct: number | null;
  growth5YPct: number | null;
  historicalYearsData: { year: number; amount: number; growthPct: number | null }[];
} {
  // Aggregate income-weighted average organic dividend growth from holdings
  const payers = holdings.filter((h) => h.isPayer && h.annualDividendBase > 0);
  const totalPayerIncome = payers.reduce((acc, h) => acc + h.annualDividendBase, 0);

  let weighted12MGrowth = 0;
  let weight12MCount = 0;
  let weighted5YGrowth = 0;
  let weight5YCount = 0;

  payers.forEach((h) => {
    const weight = totalPayerIncome > 0 ? h.annualDividendBase / totalPayerIncome : 0;
    if (h.growth12MPct !== null && !isNaN(h.growth12MPct) && Math.abs(h.growth12MPct) <= 100) {
      weighted12MGrowth += h.growth12MPct * weight;
      weight12MCount += weight;
    }
    if (h.growth5YPct !== null && !isNaN(h.growth5YPct) && Math.abs(h.growth5YPct) <= 100) {
      weighted5YGrowth += h.growth5YPct * weight;
      weight5YCount += weight;
    }
  });

  const growth12MPct = weight12MCount > 0 ? weighted12MGrowth / weight12MCount : null;
  const growth5YPct = weight5YCount > 0 ? weighted5YGrowth / weight5YCount : null;

  // Historical received dividends by calendar year (from transaction records)
  const divActivities = activities.filter(
    (a) => a.activityType === 'DIVIDEND' || a.activityType?.toUpperCase() === 'DIVIDEND',
  );

  let historicalYearsData: { year: number; amount: number; growthPct: number | null }[] = [];
  if (divActivities.length > 0) {
    const yearlySums: Record<number, number> = {};
    divActivities.forEach((a) => {
      const d = new Date(a.date);
      const year = d.getFullYear();
      const amount = Math.abs(Number(a.amount) || 0);
      yearlySums[year] = (yearlySums[year] || 0) + amount;
    });

    const years = Object.keys(yearlySums)
      .map(Number)
      .sort((a, b) => a - b);

    historicalYearsData = years.map((year, idx) => {
      const amount = yearlySums[year];
      const prevAmount = idx > 0 ? yearlySums[years[idx - 1]] : null;
      const growthPct =
        prevAmount && prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;
      return { year, amount, growthPct };
    });
  }

  return { growth12MPct, growth5YPct, historicalYearsData };
}
