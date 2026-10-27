import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@wealthfolio/ui';
import { Grid, AlertCircle, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import type { CorrelationMatrixData, ComparisonTimeframe } from '../types';
import { TickerLogo } from './ticker-logo';

interface CorrelationMatrixProps {
  correlationData: CorrelationMatrixData;
  timeframe: ComparisonTimeframe;
  onTimeframeChange: (tf: ComparisonTimeframe) => void;
}

const TIMEFRAMES: ComparisonTimeframe[] = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'];

/**
 * Returns dynamic inline styles for precise heatmap coloring:
 * - Positive: vibrant emerald / teal gradient
 * - Negative: vibrant rose / red gradient
 * - Zero / near zero: subtle neutral
 */
function getCorrelationStyle(value: number, isDiagonal = false): React.CSSProperties {
  if (isDiagonal || value >= 0.999) {
    return {
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      color: 'inherit',
      fontWeight: 700,
    };
  }

  if (value > 0) {
    // 0 to 1 -> emerald green gradient with opacity 0.12 to 0.85
    const alpha = Math.max(0.12, Math.min(0.85, value * 0.85));
    const isDark = value > 0.65;
    return {
      backgroundColor: `rgba(16, 185, 129, ${alpha})`,
      color: isDark ? '#ffffff' : 'inherit',
      fontWeight: value > 0.5 ? 600 : 500,
    };
  }

  if (value < 0) {
    // -1 to 0 -> rose / carmine red gradient with opacity 0.15 to 0.85
    const absVal = Math.abs(value);
    const alpha = Math.max(0.15, Math.min(0.85, absVal * 0.85));
    const isDark = absVal > 0.65;
    return {
      backgroundColor: `rgba(239, 68, 68, ${alpha})`,
      color: isDark ? '#ffffff' : 'inherit',
      fontWeight: absVal > 0.5 ? 600 : 500,
    };
  }

  return {
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
    color: 'inherit',
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

  const [excludeEtfs, setExcludeEtfs] = useState(false);

  const {
    symbols,
    names,
    exchanges = {},
    instrumentTypes = {},
    isEtfMap = {},
    matrix,
    pairs,
  } = correlationData;

  // Check if any ETFs exist in the correlation dataset
  const hasEtfs = useMemo(() => {
    return symbols.some((sym) => Boolean(isEtfMap[sym]));
  }, [symbols, isEtfMap]);

  // Filter symbols based on excludeEtfs toggle
  const displayedSymbols = useMemo(() => {
    if (!excludeEtfs) return symbols;
    return symbols.filter((sym) => !isEtfMap[sym]);
  }, [symbols, excludeEtfs, isEtfMap]);

  // Map each symbol to its original row/col index in `matrix`
  const symbolIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    symbols.forEach((sym, idx) => map.set(sym, idx));
    return map;
  }, [symbols]);

  // Filter pairs based on excludeEtfs toggle
  const displayedPairs = useMemo(() => {
    if (!excludeEtfs) return pairs;
    return pairs.filter((p) => !isEtfMap[p.assetASymbol] && !isEtfMap[p.assetBSymbol]);
  }, [pairs, excludeEtfs, isEtfMap]);

  // Top correlated & least correlated pairs (from filtered pairs)
  const sortedPairs = useMemo(() => {
    return [...displayedPairs].sort((a, b) => b.correlation - a.correlation);
  }, [displayedPairs]);

  const highestPairs = sortedPairs.slice(0, 3);
  const lowestPairs = [...sortedPairs].reverse().slice(0, 3);

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

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Multi-Asset Correlation Matrix
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pearson correlation on daily returns (-1.00 to +1.00). Low/negative correlations
              enhance portfolio diversification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Exclude ETFs Filter Button */}
            {hasEtfs && (
              <Button
                variant={excludeEtfs ? 'secondary' : 'outline'}
                size="sm"
                className={`h-7 px-2.5 text-xs flex items-center gap-1.5 transition-all ${
                  excludeEtfs
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/20 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setExcludeEtfs((prev) => !prev)}
                title={
                  excludeEtfs
                    ? 'Show all assets including ETFs'
                    : 'Exclude ETFs to analyze individual stocks only'
                }
              >
                <Filter className="w-3 h-3" />
                <span>{excludeEtfs ? 'ETFs Excluded' : 'Exclude ETFs'}</span>
                {excludeEtfs && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 h-3.5 bg-amber-500/20 border-amber-500/30 ml-0.5"
                  >
                    active
                  </Badge>
                )}
              </Button>
            )}

            {/* Timeframe Selector */}
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
          </div>
        </CardHeader>

        <CardContent className="p-4 overflow-x-auto">
          {displayedSymbols.length < 2 ? (
            <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8 opacity-40 text-muted-foreground" />
              <p className="font-medium">Not enough stock assets remaining after excluding ETFs.</p>
              <p className="text-xs">
                You need at least 2 non-ETF assets to compute a correlation matrix. Disable the
                filter to view all assets.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => setExcludeEtfs(false)}
              >
                Reset Filter
              </Button>
            </div>
          ) : (
            <>
              {/* Matrix Heatmap */}
              <div className="inline-block min-w-full align-middle">
                <table className="border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 border-b border-r bg-muted/20 text-left font-mono text-[11px] text-muted-foreground min-w-[90px]">
                        Asset
                      </th>
                      {displayedSymbols.map((sym) => (
                        <th
                          key={sym}
                          className="p-2 border-b text-center font-mono font-semibold text-[11px] text-foreground min-w-[72px]"
                          title={names[sym] || sym}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <TickerLogo
                              symbol={sym}
                              exchangeMic={exchanges[sym]}
                              instrumentType={instrumentTypes[sym]}
                              size="xs"
                            />
                            <span>{sym}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSymbols.map((symA) => {
                      const rowIdx = symbolIndexMap.get(symA) ?? 0;
                      return (
                        <tr key={symA} className="border-b">
                          <td
                            className="p-2 border-r font-mono font-semibold text-foreground bg-muted/20 whitespace-nowrap text-left"
                            title={names[symA] || symA}
                          >
                            <div className="flex items-center gap-1.5">
                              <TickerLogo
                                symbol={symA}
                                exchangeMic={exchanges[symA]}
                                instrumentType={instrumentTypes[symA]}
                                size="xs"
                              />
                              <span>{symA}</span>
                            </div>
                          </td>
                          {displayedSymbols.map((symB) => {
                            const colIdx = symbolIndexMap.get(symB) ?? 0;
                            const corr = matrix[rowIdx]?.[colIdx] ?? 0;
                            const isDiagonal = symA === symB;
                            const style = getCorrelationStyle(corr, isDiagonal);
                            const isHovered =
                              hoveredCell &&
                              ((hoveredCell.symA === symA && hoveredCell.symB === symB) ||
                                (hoveredCell.symA === symB && hoveredCell.symB === symA));

                            return (
                              <td
                                key={symB}
                                style={style}
                                className={`p-2.5 text-center font-mono transition-all cursor-pointer select-none rounded-xs ${
                                  isHovered ? 'ring-2 ring-primary ring-inset scale-105 z-10' : ''
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Color Scale Legend */}
              <div className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-rose-500">-1.0 (Inverse)</span>
                  <div
                    className="w-36 h-2.5 rounded-full"
                    style={{
                      background:
                        'linear-gradient(to right, rgba(239, 68, 68, 0.85), rgba(100, 116, 139, 0.15) 50%, rgba(16, 185, 129, 0.85))',
                    }}
                  />
                  <span className="font-semibold text-emerald-500">+1.0 (Correlated)</span>
                </div>
                <span className="text-xs">Hover a cell to inspect pair relationship</span>
              </div>
            </>
          )}

          {/* Hovered Cell Detail Box */}
          {hoveredCell && (
            <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border/60 flex items-center justify-between text-xs animate-in fade-in-50">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <TickerLogo
                    symbol={hoveredCell.symA}
                    exchangeMic={exchanges[hoveredCell.symA]}
                    instrumentType={instrumentTypes[hoveredCell.symA]}
                    size="xs"
                  />
                  <span className="font-mono font-bold">{hoveredCell.symA}</span>
                  <span className="text-muted-foreground">vs</span>
                  <TickerLogo
                    symbol={hoveredCell.symB}
                    exchangeMic={exchanges[hoveredCell.symB]}
                    instrumentType={instrumentTypes[hoveredCell.symB]}
                    size="xs"
                  />
                  <span className="font-mono font-bold">{hoveredCell.symB}</span>
                </div>
                <span className="text-muted-foreground hidden sm:inline">
                  ({hoveredCell.nameA} & {hoveredCell.nameB})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm font-mono">
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
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              <span>Highest Correlated Pairs (Co-Movement)</span>
            </div>
            {excludeEtfs && (
              <Badge
                variant="outline"
                className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30"
              >
                Stocks only
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {highestPairs.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-xs">
                No pairs available with current filter.
              </div>
            ) : (
              <div className="divide-y text-xs">
                {highestPairs.map((pair) => (
                  <div
                    key={`${pair.assetASymbol}-${pair.assetBSymbol}`}
                    className="py-2 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 font-mono font-medium">
                      <TickerLogo
                        symbol={pair.assetASymbol}
                        exchangeMic={exchanges[pair.assetASymbol]}
                        instrumentType={instrumentTypes[pair.assetASymbol]}
                        size="xs"
                      />
                      <span>{pair.assetASymbol}</span>
                      <span className="text-muted-foreground">↔</span>
                      <TickerLogo
                        symbol={pair.assetBSymbol}
                        exchangeMic={exchanges[pair.assetBSymbol]}
                        instrumentType={instrumentTypes[pair.assetBSymbol]}
                        size="xs"
                      />
                      <span>{pair.assetBSymbol}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="font-mono text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    >
                      +{(pair.correlation * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lowest / Negative Correlation */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
              <span>Most Diversifying Pairs (Low / Negative)</span>
            </div>
            {excludeEtfs && (
              <Badge
                variant="outline"
                className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30"
              >
                Stocks only
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {lowestPairs.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-xs">
                No pairs available with current filter.
              </div>
            ) : (
              <div className="divide-y text-xs">
                {lowestPairs.map((pair) => (
                  <div
                    key={`${pair.assetASymbol}-${pair.assetBSymbol}`}
                    className="py-2 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 font-mono font-medium">
                      <TickerLogo
                        symbol={pair.assetASymbol}
                        exchangeMic={exchanges[pair.assetASymbol]}
                        instrumentType={instrumentTypes[pair.assetASymbol]}
                        size="xs"
                      />
                      <span>{pair.assetASymbol}</span>
                      <span className="text-muted-foreground">↔</span>
                      <TickerLogo
                        symbol={pair.assetBSymbol}
                        exchangeMic={exchanges[pair.assetBSymbol]}
                        instrumentType={instrumentTypes[pair.assetBSymbol]}
                        size="xs"
                      />
                      <span>{pair.assetBSymbol}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs ${
                        pair.correlation < 0
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                          : 'bg-muted/40'
                      }`}
                    >
                      {pair.correlation >= 0 ? '+' : ''}
                      {(pair.correlation * 100).toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
