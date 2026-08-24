import React, { useState } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';
import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  DateRangeSelector,
  type DateRange,
} from '@wealthfolio/ui';
import { TrendingUp, Grid, RefreshCw, LineChart } from 'lucide-react';
import type { PortfolioScope, ComparisonTimeframe, AssetPerformanceItem } from '../types';
import { useAssetsPerformance } from '../hooks/use-assets-performance';
import { PortfolioScopeFilter } from './portfolio-scope-filter';
import { BenchmarkSelector } from './benchmark-selector';
import { PerformanceKpis } from './performance-kpis';
import { AssetsTable } from './assets-table';
import { CorrelationMatrix } from './correlation-matrix';
import { PerformanceComparisonChart } from './performance-comparison-chart';
import { AssetDetailModal } from './asset-detail-modal';

interface AssetsPerformanceDashboardProps {
  api: HostAPI;
}

export const AssetsPerformanceDashboard: React.FC<AssetsPerformanceDashboardProps> = ({ api }) => {
  const [scope, setScope] = useState<PortfolioScope>({ type: 'all', label: 'All Portfolios' });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string>('^GSPC');
  const [chartTimeframe, setChartTimeframe] = useState<ComparisonTimeframe>('1Y');
  const [correlationTimeframe, setCorrelationTimeframe] = useState<ComparisonTimeframe>('1Y');
  const [selectedAssetSymbols, setSelectedAssetSymbols] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('comparison');
  const [inspectedAsset, setInspectedAsset] = useState<AssetPerformanceItem | null>(null);

  const { data, isLoading, isFetching, refetch, error } = useAssetsPerformance({
    api,
    scope,
    benchmarkSymbol,
    dateRange,
    correlationTimeframe,
  });

  const {
    assets = [],
    correlationMatrix,
    portfolioSeries = [],
    benchmarkSeries = [],
    baseCurrency,
    totalPortfolioValue,
  } = data || {};

  // Initialize selected assets for chart if empty (default to top 3 by market value)
  React.useEffect(() => {
    if (assets.length > 0 && selectedAssetSymbols.length === 0) {
      setSelectedAssetSymbols(assets.slice(0, 3).map((a: AssetPerformanceItem) => a.symbol));
    }
  }, [assets]);

  const handleToggleAssetSelection = (symbol: string) => {
    setSelectedAssetSymbols((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );
  };

  const handleSelectAllVisible = (symbols: string[]) => {
    setSelectedAssetSymbols(symbols);
  };

  return (
    <div className="flex-1 space-y-6 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <LineChart className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Assets Performance & Correlation</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Individual IRR & TWR calculations, multi-asset correlation matrices, and benchmark
            comparisons
          </p>
        </div>

        {/* Global Controls matching Monthly Performance */}
        <div className="flex flex-wrap items-center gap-2.5">
          <DateRangeSelector value={dateRange} onChange={setDateRange} hiddenRanges={['1D']} />
          <PortfolioScopeFilter api={api} scope={scope} onScopeChange={setScope} />
          <BenchmarkSelector
            selectedSymbol={benchmarkSymbol}
            onSelectBenchmark={setBenchmarkSymbol}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 w-9"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Calculating asset returns & correlation...</span>
        </div>
      ) : error ? (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">
            Failed to load asset performance data. Please check your network and try again.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Top KPI Cards */}
          <PerformanceKpis
            assets={assets}
            baseCurrency={baseCurrency}
            totalPortfolioValue={totalPortfolioValue}
          />

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full sm:w-auto grid-cols-2">
              <TabsTrigger value="comparison" className="flex items-center gap-2 text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Overview & Comparison</span>
              </TabsTrigger>
              <TabsTrigger value="correlation" className="flex items-center gap-2 text-xs">
                <Grid className="w-3.5 h-3.5" />
                <span>Correlation Matrix</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Comparison & Table */}
            <TabsContent value="comparison" className="space-y-4">
              <PerformanceComparisonChart
                assets={assets}
                selectedSymbols={selectedAssetSymbols}
                portfolioSeries={portfolioSeries}
                benchmarkSeries={benchmarkSeries}
                benchmarkSymbol={benchmarkSymbol}
                timeframe={dateRange ?? chartTimeframe}
                onTimeframeChange={setChartTimeframe}
              />

              <AssetsTable
                assets={assets}
                baseCurrency={baseCurrency}
                selectedAssetSymbols={selectedAssetSymbols}
                onToggleAssetSelection={handleToggleAssetSelection}
                onSelectAllVisible={handleSelectAllVisible}
                onOpenAssetDetail={setInspectedAsset}
              />
            </TabsContent>

            {/* Tab 2: Correlation Matrix */}
            <TabsContent value="correlation" className="space-y-4">
              {correlationMatrix && (
                <CorrelationMatrix
                  correlationData={correlationMatrix}
                  timeframe={correlationTimeframe}
                  onTimeframeChange={setCorrelationTimeframe}
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Asset Deep Dive Modal */}
      <AssetDetailModal
        asset={inspectedAsset}
        isOpen={Boolean(inspectedAsset)}
        onClose={() => setInspectedAsset(null)}
        baseCurrency={baseCurrency}
        benchmarkSymbol={benchmarkSymbol}
      />
    </div>
  );
};
