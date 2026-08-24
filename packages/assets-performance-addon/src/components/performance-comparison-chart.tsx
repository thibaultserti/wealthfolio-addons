import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@wealthfolio/ui';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { AssetPerformanceItem, ComparisonTimeframe } from '../types';
import type { ReturnData } from '@wealthfolio/addon-sdk';
import { buildNormalizedComparisonSeries } from '../utils/benchmark-utils';

interface PerformanceComparisonChartProps {
  assets: AssetPerformanceItem[];
  selectedSymbols: string[];
  portfolioSeries: ReturnData[];
  benchmarkSeries: ReturnData[];
  benchmarkSymbol: string;
  timeframe: ComparisonTimeframe;
  onTimeframeChange: (tf: ComparisonTimeframe) => void;
}

const TIMEFRAMES: ComparisonTimeframe[] = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL'];

const ASSET_LINE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export const PerformanceComparisonChart: React.FC<PerformanceComparisonChartProps> = ({
  assets,
  selectedSymbols,
  portfolioSeries,
  benchmarkSeries,
  benchmarkSymbol,
  timeframe,
  onTimeframeChange,
}) => {
  const assetSeriesMap = useMemo(() => {
    const map = new Map<string, { symbol: string; series: ReturnData[] }>();
    for (const a of assets) {
      if (selectedSymbols.includes(a.symbol) && a.quotesSeries.length > 0) {
        map.set(a.symbol, { symbol: a.symbol, series: a.quotesSeries });
      }
    }
    return map;
  }, [assets, selectedSymbols]);

  const chartData = useMemo(() => {
    return buildNormalizedComparisonSeries({
      timeframe,
      portfolioSeries,
      benchmarkSeries,
      benchmarkSymbol,
      assetSeriesMap,
    });
  }, [timeframe, portfolioSeries, benchmarkSeries, benchmarkSymbol, assetSeriesMap]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 border-b flex flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LineChartIcon className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Normalized Performance Comparison (Rebased to 0%)
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare cumulative returns of selected assets vs Portfolio and Benchmark over the same
            period
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
      <CardContent className="p-4">
        {chartData.length < 2 ? (
          <div className="h-72 flex items-center justify-center text-xs text-muted-foreground">
            No historical price data available for the selected timeframe.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(str) => {
                    if (!str) return '';
                    const d = new Date(str);
                    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                  }}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  opacity={0.5}
                />
                <YAxis
                  tickFormatter={(val) => `${val >= 0 ? '+' : ''}${val}%`}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  opacity={0.5}
                />
                <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" opacity={0.5} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`,
                    name === 'portfolio'
                      ? 'Portfolio'
                      : name === 'benchmark'
                        ? `Benchmark (${benchmarkSymbol})`
                        : name,
                  ]}
                  labelFormatter={(label: any) =>
                    label ? new Date(String(label)).toLocaleDateString() : ''
                  }
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '8px',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  formatter={(value) => {
                    if (value === 'portfolio')
                      return <span className="font-semibold">Portfolio</span>;
                    if (value === 'benchmark')
                      return <span className="font-semibold">Benchmark ({benchmarkSymbol})</span>;
                    return <span>{value}</span>;
                  }}
                />

                {/* Portfolio Line */}
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="portfolio"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={false}
                />

                {/* Benchmark Line */}
                {benchmarkSymbol && (
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    name="benchmark"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                )}

                {/* Selected Assets Lines */}
                {selectedSymbols.map((sym, idx) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    name={sym}
                    stroke={ASSET_LINE_COLORS[idx % ASSET_LINE_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
