import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@wealthfolio/ui';
import { Grid, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { CorrelationMatrixData, ComparisonTimeframe } from '../types';

interface CorrelationMatrixProps {
  correlationData: CorrelationMatrixData;
  timeframe: ComparisonTimeframe;
  onTimeframeChange: (tf: ComparisonTimeframe) => void;
}

const TIMEFRAMES: ComparisonTimeframe[] = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'];

function getCorrelationColor(value: number): { background: string; text: string } {
  if (value === 1) {
    return { background: 'bg-primary/20', text: 'text-foreground font-bold' };
  }

  // Positive correlation: 0 to 1 -> shades of green/emerald or blue
  if (value > 0.7) {
    return {
      background: 'bg-emerald-600/30 dark:bg-emerald-500/30',
      text: 'text-emerald-900 dark:text-emerald-200 font-semibold',
    };
  }
  if (value > 0.4) {
    return {
      background: 'bg-emerald-500/20 dark:bg-emerald-500/20',
      text: 'text-emerald-800 dark:text-emerald-300 font-medium',
    };
  }
  if (value > 0.1) {
    return {
      background: 'bg-emerald-500/10 dark:bg-emerald-500/10',
      text: 'text-emerald-700 dark:text-emerald-400',
    };
  }

  // Neutral / near zero: -0.1 to 0.1
  if (value >= -0.1) {
    return {
      background: 'bg-muted/40',
      text: 'text-muted-foreground',
    };
  }

  // Negative correlation: -1 to -0.1 -> shades of rose/red
  if (value < -0.4) {
    return {
      background: 'bg-rose-600/30 dark:bg-rose-500/30',
      text: 'text-rose-900 dark:text-rose-200 font-semibold',
    };
  }
  return {
    background: 'bg-rose-500/15 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300 font-medium',
  };
}

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  correlationData,
  timeframe,
  onTimeframeChange,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{
    symA: string;
    symB: string;
    corr: number;
    nameA: string;
    nameB: string;
  } | null>(null);

  const { symbols, names, matrix, pairs } = correlationData;

  if (symbols.length < 2) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8 opacity-40 text-muted-foreground" />
          <p className="font-medium">Not enough assets to compute a correlation matrix.</p>
          <p className="text-xs">You need at least 2 distinct assets with historical price data.</p>
        </CardContent>
      </Card>
    );
  }

  // Top correlated & least correlated pairs
  const sortedPairs = [...pairs].sort((a, b) => b.correlation - a.correlation);
  const highestPairs = sortedPairs.slice(0, 3);
  const lowestPairs = [...sortedPairs].reverse().slice(0, 3);

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Multi-Asset Correlation Matrix
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pearson correlation on daily returns (from -1.00 to +1.00). Low/negative correlations
              enhance diversification.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? 'secondary' : 'ghost'}
                size="sm"
                className={`h-7 px-2 text-xs ${
                  timeframe === tf ? 'font-semibold shadow-xs' : 'text-muted-foreground'
                }`}
                onClick={() => onTimeframeChange(tf)}
              >
                {tf}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-4 overflow-x-auto">
          {/* Matrix Heatmap */}
          <div className="inline-block min-w-full align-middle">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-2 border-b border-r bg-muted/20 text-left font-mono text-[11px] text-muted-foreground min-w-[70px]">
                    Ticker
                  </th>
                  {symbols.map((sym) => (
                    <th
                      key={sym}
                      className="p-2 border-b text-center font-mono font-semibold text-[11px] text-foreground min-w-[64px]"
                      title={names[sym] || sym}
                    >
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map((symA, rowIdx) => (
                  <tr key={symA} className="border-b">
                    <td
                      className="p-2 border-r font-mono font-semibold text-foreground bg-muted/20 whitespace-nowrap text-left"
                      title={names[symA] || symA}
                    >
                      {symA}
                    </td>
                    {symbols.map((symB, colIdx) => {
                      const corr = matrix[rowIdx]?.[colIdx] ?? 0;
                      const { background, text } = getCorrelationColor(corr);
                      const isHovered =
                        hoveredCell &&
                        ((hoveredCell.symA === symA && hoveredCell.symB === symB) ||
                          (hoveredCell.symA === symB && hoveredCell.symB === symA));

                      return (
                        <td
                          key={symB}
                          className={`p-2 text-center font-mono transition-all cursor-pointer ${background} ${text} ${
                            isHovered ? 'ring-2 ring-primary ring-inset' : ''
                          }`}
                          onMouseEnter={() =>
                            setHoveredCell({
                              symA,
                              symB,
                              corr,
                              nameA: names[symA] || symA,
                              nameB: names[symB] || symB,
                            })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {corr.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Hovered Cell Detail Box */}
          {hoveredCell && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/60 flex items-center justify-between text-xs animate-in fade-in-50">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono">
                  {hoveredCell.symA} vs {hoveredCell.symB}
                </Badge>
                <span className="text-muted-foreground">
                  {hoveredCell.nameA} & {hoveredCell.nameB}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm font-mono">
                  ρ = {hoveredCell.corr.toFixed(3)}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {hoveredCell.corr > 0.7
                    ? '(Strong positive correlation)'
                    : hoveredCell.corr > 0.3
                      ? '(Moderate correlation)'
                      : hoveredCell.corr > -0.2
                        ? '(Low correlation / Diversification benefit)'
                        : '(Inverse correlation)'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diversification Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Highest Correlation */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              Highest Correlated Pairs (Co-Movement)
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="divide-y text-xs">
              {highestPairs.map((pair) => (
                <div
                  key={`${pair.assetASymbol}-${pair.assetBSymbol}`}
                  className="py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 font-mono font-medium">
                    <span>{pair.assetASymbol}</span>
                    <span className="text-muted-foreground">↔</span>
                    <span>{pair.assetBSymbol}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    +{(pair.correlation * 100).toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lowest / Negative Correlation */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
              Most Diversifying Pairs (Low / Negative)
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="divide-y text-xs">
              {lowestPairs.map((pair) => (
                <div
                  key={`${pair.assetASymbol}-${pair.assetBSymbol}`}
                  className="py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 font-mono font-medium">
                    <span>{pair.assetASymbol}</span>
                    <span className="text-muted-foreground">↔</span>
                    <span>{pair.assetBSymbol}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${
                      pair.correlation < 0
                        ? 'border-rose-500/40 text-rose-600 dark:text-rose-400'
                        : ''
                    }`}
                  >
                    {pair.correlation >= 0 ? '+' : ''}
                    {(pair.correlation * 100).toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
