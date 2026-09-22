import React, { useState, useMemo } from 'react';
import type { HoldingDividendInfo } from '../types';
import { Card, CardContent, CardHeader, CardTitle, Input, Badge, Button } from '@wealthfolio/ui';
import { Search, ArrowUpDown, Table as TableIcon } from 'lucide-react';
import { TickerLogo } from './ticker-logo';

interface HoldingsDividendTableProps {
  holdings: HoldingDividendInfo[];
  baseCurrency: string;
}

type SortField =
  | 'symbol'
  | 'marketValue'
  | 'annualDividendBase'
  | 'dividendYieldPct'
  | 'yieldOnCostPct'
  | 'growth12MPct'
  | 'growth5YPct'
  | 'weightInIncomePct';

const MONTH_NAMES_SHORT = [
  '',
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

// 5-Tier Vibrant Colors (same system as portfolio-metrics-addon)
const C = {
  VERY_GOOD: '#22c55e', // Vert foncé / vif (Excellence)
  GOOD: '#4ade80', // Vert clair (Bon)
  AVERAGE: '#f59e0b', // Orange / Ambre (Moyen)
  BAD: '#f87171', // Rouge clair / Rose (Médiocre)
  VERY_BAD: '#ef4444', // Rouge vif (Très mauvais)
  MUTED: '#9ca3af', // Gris neutre (Non dispo / N/A)
};

const getDividendYieldColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return C.MUTED;
  if (val >= 5.0) return C.VERY_GOOD;
  if (val >= 3.5) return C.GOOD;
  if (val >= 2.0) return C.AVERAGE;
  if (val >= 1.0) return C.BAD;
  return C.VERY_BAD;
};

const getYieldOnCostColor = (
  yoc: number | null | undefined,
  divYield?: number | null | undefined,
): string => {
  if (yoc === null || yoc === undefined || isNaN(yoc) || yoc <= 0) return C.MUTED;
  if (yoc >= 6.0 || (divYield && divYield > 0 && yoc >= divYield * 1.35)) return C.VERY_GOOD;
  if (yoc >= 4.0 || (divYield && divYield > 0 && yoc > divYield)) return C.GOOD;
  if (yoc >= 2.5) return C.AVERAGE;
  if (yoc >= 1.0) return C.BAD;
  return C.VERY_BAD;
};

const getGrowth12MColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val >= 10.0) return C.VERY_GOOD;
  if (val >= 6.0) return C.GOOD;
  if (val >= 2.0) return C.AVERAGE;
  if (val >= 0) return C.BAD;
  return C.VERY_BAD;
};

const getGrowth5YColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val >= 10.0) return C.VERY_GOOD;
  if (val >= 6.0) return C.GOOD;
  if (val >= 3.0) return C.AVERAGE;
  if (val >= 0) return C.BAD;
  return C.VERY_BAD;
};

export const HoldingsDividendTable: React.FC<HoldingsDividendTableProps> = ({
  holdings,
  baseCurrency,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [payersOnly, setPayersOnly] = useState(true);
  const [sortField, setSortField] = useState<SortField>('annualDividendBase');
  const [sortAsc, setSortAsc] = useState(false);

  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: baseCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredAndSorted = useMemo(() => {
    return holdings
      .filter((h) => {
        if (payersOnly && !h.isPayer) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
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
          case 'annualDividendBase':
            valA = a.annualDividendBase;
            valB = b.annualDividendBase;
            break;
          case 'dividendYieldPct':
            valA = a.dividendYieldPct;
            valB = b.dividendYieldPct;
            break;
          case 'yieldOnCostPct':
            valA = a.yieldOnCostPct;
            valB = b.yieldOnCostPct;
            break;
          case 'growth12MPct':
            valA = a.growth12MPct ?? -9999;
            valB = b.growth12MPct ?? -9999;
            break;
          case 'growth5YPct':
            valA = a.growth5YPct ?? -9999;
            valB = b.growth5YPct ?? -9999;
            break;
          case 'weightInIncomePct':
            valA = a.weightInIncomePct;
            valB = b.weightInIncomePct;
            break;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      });
  }, [holdings, searchQuery, payersOnly, sortField, sortAsc]);

  return (
    <Card className="border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
      <CardHeader className="p-4 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Holdings Dividend Breakdown</CardTitle>
          <Badge variant="secondary" className="text-xs ml-1 font-normal">
            {filteredAndSorted.length} {filteredAndSorted.length === 1 ? 'holding' : 'holdings'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ticker or name..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-background/50"
            />
          </div>

          <Button
            variant={payersOnly ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setPayersOnly(!payersOnly)}
            className="h-8 text-xs px-2.5"
          >
            {payersOnly ? 'Payers Only' : 'All Holdings'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground uppercase text-[10px] tracking-wider select-none font-semibold">
              <th
                className="py-2.5 px-4 cursor-pointer hover:text-foreground"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center gap-1">
                  Holding <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('marketValue')}
              >
                <div className="flex items-center justify-end gap-1">
                  Market Value <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('annualDividendBase')}
              >
                <div className="flex items-center justify-end gap-1">
                  Annual Payout <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('dividendYieldPct')}
              >
                <div className="flex items-center justify-end gap-1">
                  Div Yield <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('yieldOnCostPct')}
              >
                <div className="flex items-center justify-end gap-1">
                  Yield on Cost <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">
                <span>Frequency & Schedule</span>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('growth12MPct')}
              >
                <div className="flex items-center justify-end gap-1">
                  12M Growth <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('growth5YPct')}
              >
                <div className="flex items-center justify-end gap-1">
                  5Y CAGR <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                className="py-2.5 px-4 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('weightInIncomePct')}
              >
                <div className="flex items-center justify-end gap-1">
                  Income Share <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  No holdings found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((h) => {
                const localFormatter = new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: h.currency || baseCurrency,
                  minimumFractionDigits: 2,
                });

                const monthsLabel =
                  h.payoutMonths.length > 0
                    ? h.payoutMonths.map((m) => MONTH_NAMES_SHORT[m]).join(', ')
                    : '—';

                return (
                  <tr key={h.holdingId} className="hover:bg-accent/30 transition-colors">
                    {/* Holding Symbol & Name */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <TickerLogo
                          size="md"
                          symbol={h.symbol}
                          name={h.name}
                          exchangeMic={h.exchangeMic}
                          instrumentType={h.instrumentType}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground text-xs truncate max-w-40">
                            {h.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {h.symbol} • {h.shares.toLocaleString()} shares
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Market Value */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-medium text-foreground">
                        {currencyFormatter.format(h.marketValue)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {h.weightInPortfolioPct.toFixed(1)}% of total
                      </div>
                    </td>

                    {/* Annual Payout */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-bold text-foreground">
                        {currencyFormatter.format(h.annualDividendBase)}
                      </div>
                      {h.annualDividendPerShare > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          {localFormatter.format(h.annualDividendPerShare)} / sh
                        </div>
                      )}
                    </td>

                    {/* Dividend Yield */}
                    <td
                      style={{ color: getDividendYieldColor(h.dividendYieldPct) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {h.dividendYieldPct > 0 ? `${h.dividendYieldPct.toFixed(2)}%` : '—'}
                    </td>

                    {/* Yield on Cost */}
                    <td
                      style={{ color: getYieldOnCostColor(h.yieldOnCostPct, h.dividendYieldPct) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {h.yieldOnCostPct > 0 ? `${h.yieldOnCostPct.toFixed(2)}%` : '—'}
                    </td>

                    {/* Frequency & Schedule */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase py-0 px-1.5 h-4 font-normal"
                        >
                          {h.frequency}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{monthsLabel}</span>
                      </div>
                    </td>

                    {/* 12M Growth */}
                    <td
                      style={{ color: getGrowth12MColor(h.growth12MPct) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {h.growth12MPct === null || isNaN(h.growth12MPct)
                        ? '—'
                        : `${h.growth12MPct > 0 ? '+' : ''}${h.growth12MPct.toFixed(1)}%`}
                    </td>

                    {/* 5Y CAGR */}
                    <td
                      style={{ color: getGrowth5YColor(h.growth5YPct) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {h.growth5YPct === null || isNaN(h.growth5YPct)
                        ? '—'
                        : `${h.growth5YPct > 0 ? '+' : ''}${h.growth5YPct.toFixed(1)}%`}
                    </td>

                    {/* Income Share */}
                    <td className="py-2.5 px-4 text-right font-medium text-foreground">
                      {h.weightInIncomePct > 0 ? `${h.weightInIncomePct.toFixed(1)}%` : '—'}
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
