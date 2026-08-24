import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Card,
  CardContent,
  Badge,
  formatAmount,
  formatPercent,
} from '@wealthfolio/ui';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldAlert,
  Layers,
  Globe,
  Calendar,
  DollarSign,
} from 'lucide-react';
import type { AssetPerformanceItem } from '../types';

interface AssetDetailModalProps {
  asset: AssetPerformanceItem | null;
  isOpen: boolean;
  onClose: () => void;
  baseCurrency: string;
  benchmarkSymbol: string;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  isOpen,
  onClose,
  baseCurrency,
  benchmarkSymbol,
}) => {
  if (!asset) return null;

  const twr = asset.perf.displayTwr;
  const irr = asset.perf.displayIrr;
  const risk = asset.riskMetrics;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold font-mono text-base">
                {asset.symbol}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {asset.name}
                  {asset.assetClass && (
                    <Badge variant="outline" className="text-xs">
                      {asset.assetClass}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Portfolio Weight: {asset.weight.toFixed(2)}% • Currency: {asset.currency}
                </DialogDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                {formatAmount(asset.marketValue, baseCurrency)}
              </div>
              <div className="text-xs text-muted-foreground">
                Qty: {asset.quantity} • Cost: {formatAmount(asset.costBasis, baseCurrency)}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Primary Return KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {/* TWR */}
          <Card className="p-3 shadow-xs">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Time-Weighted Return (TWR)
            </p>
            <p
              className={`text-lg font-bold mt-1 ${
                twr != null && twr >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {twr != null ? formatPercent(twr) : 'N/A'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {asset.perf.isAnnualized ? 'Annualized return' : 'Total period return'}
            </p>
          </Card>

          {/* IRR / XIRR */}
          <Card className="p-3 shadow-xs bg-primary/5 border-primary/20">
            <p className="text-[11px] text-primary font-semibold uppercase tracking-wider">
              IRR / TRI (Money-Weighted)
            </p>
            <p
              className={`text-lg font-bold mt-1 ${
                irr != null && irr >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {irr != null ? formatPercent(irr) : 'N/A'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {asset.perf.isAnnualized ? 'Annualized IRR' : 'Total period IRR'}
            </p>
          </Card>

          {/* Unrealized PnL */}
          <Card className="p-3 shadow-xs">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Unrealized PnL
            </p>
            <p
              className={`text-lg font-bold mt-1 ${
                asset.unrealizedPnl >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {asset.unrealizedPnl >= 0 ? '+' : ''}
              {formatAmount(asset.unrealizedPnl, baseCurrency)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {asset.unrealizedPnlPercent != null ? formatPercent(asset.unrealizedPnlPercent) : '-'}
            </p>
          </Card>

          {/* Total Return / Dividends included */}
          <Card className="p-3 shadow-xs">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Total Gain (PnL + Div.)
            </p>
            <p
              className={`text-lg font-bold mt-1 ${
                asset.totalGain >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {asset.totalGain >= 0 ? '+' : ''}
              {formatAmount(asset.totalGain, baseCurrency)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {asset.totalGainPercent != null ? formatPercent(asset.totalGainPercent) : '-'}
            </p>
          </Card>
        </div>

        {/* Statistical Risk & Comparison Metrics */}
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Risk & Benchmark Comparison ({benchmarkSymbol || 'Benchmark'})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
              <span className="text-muted-foreground block text-[10px]">Alpha vs Benchmark</span>
              <span className="font-semibold font-mono text-sm">
                {risk?.alpha != null ? formatPercent(risk.alpha) : 'N/A'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
              <span className="text-muted-foreground block text-[10px]">Beta vs Benchmark</span>
              <span className="font-semibold font-mono text-sm">
                {risk?.beta != null ? risk.beta.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
              <span className="text-muted-foreground block text-[10px]">Annualized Volatility</span>
              <span className="font-semibold font-mono text-sm">
                {risk?.volatility != null ? formatPercent(risk.volatility) : 'N/A'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
              <span className="text-muted-foreground block text-[10px]">Sharpe Ratio</span>
              <span className="font-semibold font-mono text-sm">
                {risk?.sharpeRatio != null ? risk.sharpeRatio.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
              <span className="text-muted-foreground block text-[10px]">Max Drawdown</span>
              <span className="font-semibold font-mono text-sm text-rose-500">
                {risk?.maxDrawdown != null ? `-${formatPercent(risk.maxDrawdown)}` : 'N/A'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs">
              <span className="text-muted-foreground block text-[10px]">Corr. with Benchmark</span>
              <span className="font-semibold font-mono text-sm">
                {risk?.correlationBenchmark != null
                  ? `${(risk.correlationBenchmark * 100).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs col-span-2">
              <span className="text-muted-foreground block text-[10px]">Corr. with Portfolio</span>
              <span className="font-semibold font-mono text-sm">
                {risk?.correlationPortfolio != null
                  ? `${(risk.correlationPortfolio * 100).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Cash Flows List used for XIRR */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cash Flows for IRR / TRI Solver ({asset.cashFlows.length} flows)
            </h4>
          </div>
          <div className="border rounded-lg max-h-48 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b text-[11px] text-muted-foreground sticky top-0">
                <tr>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Type / Description</th>
                  <th className="py-2 px-3 text-right">Cash Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {asset.cashFlows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-muted-foreground">
                      No cash flows recorded for this asset.
                    </td>
                  </tr>
                ) : (
                  asset.cashFlows.map((cf, idx) => {
                    const isTerminal = idx === asset.cashFlows.length - 1 && cf.amount > 0;
                    const isOutflow = cf.amount < 0;
                    const dateStr =
                      typeof cf.date === 'string'
                        ? cf.date.split('T')[0]
                        : cf.date.toLocaleDateString();

                    return (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="py-2 px-3 text-muted-foreground">{dateStr}</td>
                        <td className="py-2 px-3 font-sans">
                          {isTerminal ? (
                            <Badge variant="outline" className="text-[10px] text-primary">
                              Terminal Market Value
                            </Badge>
                          ) : isOutflow ? (
                            <span className="text-rose-600 dark:text-rose-400">Buy / Inflow</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Sell / Dividend
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            isOutflow
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {cf.amount >= 0 ? '+' : ''}
                          {formatAmount(cf.amount, baseCurrency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
