import React from 'react';
import { Card, CardContent, formatAmount, formatPercent } from '@wealthfolio/ui';
import { TrendingUp, TrendingDown, Target, PieChart } from 'lucide-react';
import type { AssetPerformanceItem } from '../types';
import { TickerLogo } from './ticker-logo';

interface PerformanceKpisProps {
  assets: AssetPerformanceItem[];
  baseCurrency: string;
  totalPortfolioValue: number;
}

export const PerformanceKpis: React.FC<PerformanceKpisProps> = ({
  assets,
  baseCurrency,
  totalPortfolioValue,
}) => {
  if (assets.length === 0) return null;

  // Best performer by display IRR or TWR
  const assetsWithPerf = assets.filter(
    (a) => a.perf.displayIrr != null || a.perf.displayTwr != null,
  );

  const bestPerformer = assetsWithPerf.reduce<AssetPerformanceItem | null>((best, curr) => {
    const currVal = curr.perf.displayIrr ?? curr.perf.displayTwr ?? -Infinity;
    if (!best) return curr;
    const bestVal = best.perf.displayIrr ?? best.perf.displayTwr ?? -Infinity;
    return currVal > bestVal ? curr : best;
  }, null);

  const worstPerformer = assetsWithPerf.reduce<AssetPerformanceItem | null>((worst, curr) => {
    const currVal = curr.perf.displayIrr ?? curr.perf.displayTwr ?? Infinity;
    if (!worst) return curr;
    const worstVal = worst.perf.displayIrr ?? worst.perf.displayTwr ?? Infinity;
    return currVal < worstVal ? curr : worst;
  }, null);

  // Weighted average IRR
  let weightedIrrSum = 0;
  let weightedIrrWeightTotal = 0;

  for (const a of assets) {
    const irr = a.perf.displayIrr;
    if (irr != null && a.marketValue > 0) {
      weightedIrrSum += irr * a.marketValue;
      weightedIrrWeightTotal += a.marketValue;
    }
  }

  const weightedAverageIrr =
    weightedIrrWeightTotal > 0 ? weightedIrrSum / weightedIrrWeightTotal : null;

  // Weighted average TWR
  let weightedTwrSum = 0;
  let weightedTwrWeightTotal = 0;

  for (const a of assets) {
    const twr = a.perf.displayTwr;
    if (twr != null && a.marketValue > 0) {
      weightedTwrSum += twr * a.marketValue;
      weightedTwrWeightTotal += a.marketValue;
    }
  }

  const weightedAverageTwr =
    weightedTwrWeightTotal > 0 ? weightedTwrSum / weightedTwrWeightTotal : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Portfolio Value & Asset Count */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Analyzed Assets
            </p>
            <h3 className="text-xl font-bold tracking-tight mt-1">
              {formatAmount(totalPortfolioValue, baseCurrency)}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {assets.length} active asset{assets.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <PieChart className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Weighted Average IRR & TWR */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Weighted Avg IRR (TRI)
            </p>
            <h3
              className={`text-xl font-bold tracking-tight mt-1 ${
                weightedAverageIrr != null && weightedAverageIrr >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {weightedAverageIrr != null ? formatPercent(weightedAverageIrr) : 'N/A'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              TWR: {weightedAverageTwr != null ? formatPercent(weightedAverageTwr) : 'N/A'}
            </p>
          </div>
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
            <Target className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Top Performer */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Top Asset Performer
            </p>
            <div className="flex items-center gap-2 mt-1">
              {bestPerformer && <TickerLogo symbol={bestPerformer.symbol} size="sm" />}
              <h3 className="text-lg font-bold tracking-tight truncate max-w-[120px]">
                {bestPerformer ? bestPerformer.symbol : 'N/A'}
              </h3>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              {bestPerformer &&
              (bestPerformer.perf.displayIrr ?? bestPerformer.perf.displayTwr) != null
                ? `+${formatPercent(
                    bestPerformer.perf.displayIrr ?? bestPerformer.perf.displayTwr ?? 0,
                  )} (${bestPerformer.perf.isAnnualized ? 'ann.' : 'tot.'})`
                : '-'}
            </p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Worst Performer */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Lowest Asset Performer
            </p>
            <div className="flex items-center gap-2 mt-1">
              {worstPerformer && <TickerLogo symbol={worstPerformer.symbol} size="sm" />}
              <h3 className="text-lg font-bold tracking-tight truncate max-w-[120px]">
                {worstPerformer ? worstPerformer.symbol : 'N/A'}
              </h3>
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-0.5">
              {worstPerformer &&
              (worstPerformer.perf.displayIrr ?? worstPerformer.perf.displayTwr) != null
                ? `${formatPercent(
                    worstPerformer.perf.displayIrr ?? worstPerformer.perf.displayTwr ?? 0,
                  )} (${worstPerformer.perf.isAnnualized ? 'ann.' : 'tot.'})`
                : '-'}
            </p>
          </div>
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
            <TrendingDown className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
