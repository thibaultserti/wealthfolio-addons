import React from 'react';
import type { MonthProjection } from '../types';
import { Card, CardContent, CardHeader, CardTitle, Badge, Progress } from '@wealthfolio/ui';
import { Calendar, ChevronRight, ChevronLeft, Layers } from 'lucide-react';
import { TickerLogo } from './ticker-logo';

interface MonthDetailViewProps {
  projections: MonthProjection[];
  selectedMonthKey: string;
  baseCurrency: string;
  onSelectMonth: (monthKey: string) => void;
}

export const MonthDetailView: React.FC<MonthDetailViewProps> = ({
  projections,
  selectedMonthKey,
  baseCurrency,
  onSelectMonth,
}) => {
  const currentProjectionIndex = projections.findIndex((p) => p.key === selectedMonthKey);
  const projection =
    currentProjectionIndex >= 0 ? projections[currentProjectionIndex] : projections[0];

  if (!projection) return null;

  const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: baseCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const prevMonth = currentProjectionIndex > 0 ? projections[currentProjectionIndex - 1] : null;
  const nextMonth =
    currentProjectionIndex < projections.length - 1
      ? projections[currentProjectionIndex + 1]
      : null;

  return (
    <Card className="border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
      <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              {projection.monthLabel} Breakdown
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-0.5">
              {projection.payoutCount}{' '}
              {projection.payoutCount === 1 ? 'dividend source' : 'dividend sources'} scheduled
            </div>
          </div>
        </div>

        {/* Month navigation pills & Month Total */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Month Total
            </div>
            <div className="text-lg font-bold text-foreground">
              {currencyFormatter.format(projection.totalAmountBase)}
            </div>
          </div>

          <div className="flex items-center gap-1 border border-border/60 rounded-md p-0.5 bg-muted/20">
            <button
              onClick={() => prevMonth && onSelectMonth(prevMonth.key)}
              disabled={!prevMonth}
              className="p-1 rounded-xs hover:bg-accent disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
              title={prevMonth ? `Previous (${prevMonth.shortMonthLabel})` : undefined}
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => nextMonth && onSelectMonth(nextMonth.key)}
              disabled={!nextMonth}
              className="p-1 rounded-xs hover:bg-accent disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
              title={nextMonth ? `Next (${nextMonth.shortMonthLabel})` : undefined}
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Month quick selection bar */}
      <div className="px-4 py-2 bg-muted/10 border-b border-border/40 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
        {projections.map((p) => {
          const isSelected = p.key === selectedMonthKey;
          return (
            <button
              key={p.key}
              onClick={() => onSelectMonth(p.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{p.shortMonthLabel}</span>
              {p.totalAmountBase > 0 && (
                <span
                  className={`ml-1.5 text-[10px] ${
                    isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground'
                  }`}
                >
                  {currencyFormatter.format(p.totalAmountBase).replace(/\.00$/, '')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <CardContent className="p-4">
        {projection.items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Layers className="w-8 h-8 opacity-30" />
            <div className="text-sm font-medium">
              No dividends scheduled for {projection.monthLabel}
            </div>
            <div className="text-xs text-muted-foreground max-w-sm">
              None of your active holdings are projected to distribute dividends during this month.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {projection.items.map((item) => {
              const localFormatter = new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: item.currency || baseCurrency,
                minimumFractionDigits: 2,
              });

              return (
                <div
                  key={`${projection.key}-${item.holdingId}-${item.symbol}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border/50 bg-card/40 hover:bg-accent/30 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TickerLogo
                      size="lg"
                      symbol={item.symbol}
                      name={item.name}
                      exchangeMic={item.exchangeMic}
                      instrumentType={item.instrumentType}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate text-foreground">
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {item.symbol}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase py-0 px-1.5 h-4"
                        >
                          {item.frequency}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span>{item.shares.toLocaleString()} shares</span>
                        <span>•</span>
                        <span>{localFormatter.format(item.dividendPerShare)} / share</span>
                        <span>•</span>
                        <span>Est. Date: {item.estimatedDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
                    <div className="text-right">
                      <div className="text-sm font-bold text-foreground">
                        {currencyFormatter.format(item.amountBase)}
                      </div>
                      {item.currency !== baseCurrency && (
                        <div className="text-[10px] text-muted-foreground">
                          {localFormatter.format(item.amountLocal)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 w-24 mt-1">
                      <Progress value={item.percentOfMonthTotal} className="h-1.5" />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {item.percentOfMonthTotal.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
