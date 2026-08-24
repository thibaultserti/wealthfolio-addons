import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Badge,
  formatAmount,
  formatPercent,
} from '@wealthfolio/ui';
import { Search, ArrowUpDown } from 'lucide-react';
import type { AssetPerformanceItem } from '../types';
import { TickerLogo } from './ticker-logo';

interface AssetsTableProps {
  assets: AssetPerformanceItem[];
  baseCurrency: string;
}

type SortField =
  | 'symbol'
  | 'marketValue'
  | 'costBasis'
  | 'unrealizedPnl'
  | 'unrealizedPnlPercent'
  | 'totalReturnPercent'
  | 'twr'
  | 'irr'
  | 'weight';

type SortOrder = 'asc' | 'desc';

export const AssetsTable: React.FC<AssetsTableProps> = ({ assets, baseCurrency }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('marketValue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) return assets;
    const term = searchTerm.toLowerCase().trim();
    return assets.filter(
      (a) =>
        a.symbol.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term) ||
        (a.assetClass && a.assetClass.toLowerCase().includes(term)),
    );
  }, [assets, searchTerm]);

  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case 'symbol':
          valA = a.symbol;
          valB = b.symbol;
          break;
        case 'marketValue':
          valA = a.marketValue;
          valB = b.marketValue;
          break;
        case 'costBasis':
          valA = a.costBasis;
          valB = b.costBasis;
          break;
        case 'unrealizedPnl':
          valA = a.unrealizedPnl;
          valB = b.unrealizedPnl;
          break;
        case 'unrealizedPnlPercent':
          valA = a.unrealizedPnlPercent ?? -Infinity;
          valB = b.unrealizedPnlPercent ?? -Infinity;
          break;
        case 'totalReturnPercent':
          valA = a.totalReturnPercent ?? -Infinity;
          valB = b.totalReturnPercent ?? -Infinity;
          break;
        case 'twr':
          valA = a.perf.displayTwr ?? -Infinity;
          valB = b.perf.displayTwr ?? -Infinity;
          break;
        case 'irr':
          valA = a.perf.displayIrr ?? -Infinity;
          valB = b.perf.displayIrr ?? -Infinity;
          break;
        case 'weight':
          valA = a.weight;
          valB = b.weight;
          break;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [filteredAssets, sortField, sortOrder]);

  return (
    <Card className="border shadow-xs">
      <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Holdings Performance</CardTitle>
          <Badge variant="secondary" className="text-xs font-mono">
            {assets.length} {assets.length === 1 ? 'Asset' : 'Assets'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 w-full max-w-xs">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by ticker or name..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-y bg-muted/40 text-muted-foreground font-medium select-none">
              <th
                className="py-2.5 px-3 text-left cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center gap-1">
                  <span>Asset</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('marketValue')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Market Value</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('weight')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Weight</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('costBasis')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Cost Basis</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('unrealizedPnl')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>PnL</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('twr')}
                title="Time-Weighted Return: compound growth of asset price"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>TWR</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('irr')}
                title="Money-Weighted Return (Internal Rate of Return / TRI)"
              >
                <div className="flex items-center justify-end gap-1">
                  <span className="font-semibold text-primary">IRR (TRI)</span>
                  <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedAssets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No assets found for the selected portfolio scope.
                </td>
              </tr>
            ) : (
              sortedAssets.map((asset) => {
                const twr = asset.perf.displayTwr;
                const irr = asset.perf.displayIrr;
                const isPositivePnl = asset.unrealizedPnl >= 0;

                return (
                  <tr key={asset.symbol} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <TickerLogo symbol={asset.symbol} size="sm" />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground font-mono">
                              {asset.symbol}
                            </span>
                            {asset.assetClass && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {asset.assetClass}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {asset.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {formatAmount(asset.marketValue, baseCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {asset.weight.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatAmount(asset.costBasis, baseCurrency)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-medium ${
                        isPositivePnl
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      <div className="flex flex-col items-end">
                        <span>
                          {isPositivePnl ? '+' : ''}
                          {formatAmount(asset.unrealizedPnl, baseCurrency)}
                        </span>
                        {asset.unrealizedPnlPercent != null && (
                          <span className="text-[10px] opacity-80">
                            {formatPercent(asset.unrealizedPnlPercent)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-medium ${
                        twr != null && twr >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {twr != null ? (
                        <div className="flex flex-col items-end">
                          <span>{formatPercent(twr)}</span>
                          <span className="text-[9px] text-muted-foreground">
                            {asset.perf.isAnnualized ? 'ann.' : 'tot.'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-semibold ${
                        irr != null && irr >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {irr != null ? (
                        <div className="flex flex-col items-end">
                          <span>{formatPercent(irr)}</span>
                          <span className="text-[9px] text-muted-foreground">
                            {asset.perf.isAnnualized ? 'ann.' : 'tot.'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
