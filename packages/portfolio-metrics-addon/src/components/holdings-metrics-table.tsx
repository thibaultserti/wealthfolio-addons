import React, { useState, useMemo } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import type { StockHoldingMetric } from '../types';
import { TickerLogo } from './ticker-logo';

interface HoldingsMetricsTableProps {
  holdings: StockHoldingMetric[];
  baseCurrency: string;
}

type SortField =
  | 'weight'
  | 'marketCap'
  | 'marketValue'
  | 'qualityScore'
  | 'operatingMargin'
  | 'netMargin'
  | 'roic'
  | 'revenueGrowth'
  | 'epsGrowth'
  | 'peRatio'
  | 'forwardPE'
  | 'pegRatio'
  | 'peOnCost'
  | 'symbol';

// 5-Tier Vibrant Colors
const C = {
  VERY_GOOD: '#22c55e', // Vert foncé / vif (Excellence)
  GOOD: '#4ade80', // Vert clair (Bon)
  AVERAGE: '#f59e0b', // Orange / Ambre (Moyen)
  BAD: '#f87171', // Rouge clair / Rose (Médiocre)
  VERY_BAD: '#ef4444', // Rouge vif (Très mauvais)
  MUTED: '#9ca3af', // Gris neutre (Non dispo / N/A)
};

const getQualityScoreStyle = (score: number) => {
  if (score >= 16) {
    return { bg: 'rgba(20, 83, 45, 0.4)', color: '#4ade80', border: '#15803d' };
  } else if (score >= 13) {
    return { bg: 'rgba(6, 78, 59, 0.3)', color: '#34d399', border: '#047857' };
  } else if (score >= 10) {
    return { bg: 'rgba(120, 53, 15, 0.3)', color: '#fbbf24', border: '#b45309' };
  } else if (score >= 7) {
    return { bg: 'rgba(136, 19, 55, 0.3)', color: '#fb7185', border: '#be123c' };
  }
  return { bg: 'rgba(127, 29, 29, 0.4)', color: '#f87171', border: '#b91c1c' };
};

const getOperatingMarginColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val >= 30) return C.VERY_GOOD;
  if (val >= 18) return C.GOOD;
  if (val >= 10) return C.AVERAGE;
  if (val >= 5) return C.BAD;
  return C.VERY_BAD;
};

const getNetMarginColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val >= 22) return C.VERY_GOOD;
  if (val >= 14) return C.GOOD;
  if (val >= 8) return C.AVERAGE;
  if (val >= 4) return C.BAD;
  return C.VERY_BAD;
};

const getRoicColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val >= 20) return C.VERY_GOOD;
  if (val >= 14) return C.GOOD;
  if (val >= 8) return C.AVERAGE;
  if (val >= 4) return C.BAD;
  return C.VERY_BAD;
};

const getGrowthColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val >= 14) return C.VERY_GOOD;
  if (val >= 8) return C.GOOD;
  if (val >= 3) return C.AVERAGE;
  if (val >= 0) return C.BAD;
  return C.VERY_BAD;
};

const getPeColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val <= 0 || val > 50) return C.VERY_BAD;
  if (val > 35) return C.BAD;
  if (val > 25) return C.AVERAGE;
  if (val > 18) return C.GOOD;
  return C.VERY_GOOD;
};

const getForwardPeColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val <= 0 || val > 45) return C.VERY_BAD;
  if (val > 30) return C.BAD;
  if (val > 22) return C.AVERAGE;
  if (val > 16) return C.GOOD;
  return C.VERY_GOOD;
};

const getPegColor = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return C.MUTED;
  if (val <= 0 || val > 3.5) return C.VERY_BAD;
  if (val > 2.5) return C.BAD;
  if (val > 1.8) return C.AVERAGE;
  if (val > 1.2) return C.GOOD;
  return C.VERY_GOOD;
};

const getPeOnCostColor = (
  peOnCost: number | null | undefined,
  peRatio: number | null | undefined,
): string => {
  if (peOnCost === null || peOnCost === undefined || isNaN(peOnCost)) return C.MUTED;
  if (!peRatio) return C.AVERAGE;
  if (peOnCost <= peRatio * 0.75) return C.VERY_GOOD;
  if (peOnCost < peRatio) return C.GOOD;
  if (peOnCost <= peRatio * 1.05) return C.AVERAGE;
  if (peOnCost <= peRatio * 1.25) return C.BAD;
  return C.VERY_BAD;
};

export const HoldingsMetricsTable: React.FC<HoldingsMetricsTableProps> = ({
  holdings,
  baseCurrency,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('weight');
  const [sortAsc, setSortAsc] = useState(false);
  const [minQualityFilter, setMinQualityFilter] = useState<number | null>(null);

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
        if (minQualityFilter !== null && h.qualityScore < minQualityFilter) {
          return false;
        }
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        switch (sortField) {
          case 'symbol':
            valA = a.symbol;
            valB = b.symbol;
            break;
          case 'weight':
            valA = a.weight;
            valB = b.weight;
            break;
          case 'marketCap':
            valA = a.marketCap ?? 0;
            valB = b.marketCap ?? 0;
            break;
          case 'marketValue':
            valA = a.marketValue;
            valB = b.marketValue;
            break;
          case 'qualityScore':
            valA = a.qualityScore;
            valB = b.qualityScore;
            break;
          case 'operatingMargin':
            valA = a.operatingMargin ?? -9999;
            valB = b.operatingMargin ?? -9999;
            break;
          case 'netMargin':
            valA = a.netMargin ?? -9999;
            valB = b.netMargin ?? -9999;
            break;
          case 'roic':
            valA = a.roic ?? -9999;
            valB = b.roic ?? -9999;
            break;
          case 'revenueGrowth':
            valA = a.revenueGrowth ?? -9999;
            valB = b.revenueGrowth ?? -9999;
            break;
          case 'epsGrowth':
            valA = a.epsGrowth ?? -9999;
            valB = b.epsGrowth ?? -9999;
            break;
          case 'peRatio':
            valA = a.peRatio ?? 9999;
            valB = b.peRatio ?? 9999;
            break;
          case 'forwardPE':
            valA = a.forwardPE ?? 9999;
            valB = b.forwardPE ?? 9999;
            break;
          case 'pegRatio':
            valA = a.pegRatio ?? 9999;
            valB = b.pegRatio ?? 9999;
            break;
          case 'peOnCost':
            valA = a.peOnCost ?? 9999;
            valB = b.peOnCost ?? 9999;
            break;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [holdings, searchTerm, sortField, sortAsc, minQualityFilter]);

  const fmtPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return `${val.toFixed(1)}%`;
  };

  const fmtMultiple = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return val.toFixed(1);
  };

  const fmtMarketCap = (valInMillions: number | null | undefined) => {
    if (
      valInMillions === null ||
      valInMillions === undefined ||
      isNaN(valInMillions) ||
      valInMillions === 0
    ) {
      return '—';
    }
    if (valInMillions >= 1000) {
      return `${(valInMillions / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mrd`;
    }
    return `${valInMillions.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} M`;
  };

  const fmtCurrency = (val: number) => {
    return Math.round(val).toLocaleString('fr-FR');
  };

  return (
    <div className="space-y-4">
      {/* Search & Quality Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Détail des positions actions</span>
          <span className="ml-2 hidden md:inline">
            Fondamentaux, marges, valorisations (P/E, Forward P/E, PEG) avec gradient de qualité
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher ticker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/80 rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center rounded-md border border-border/80 bg-muted/20 p-0.5 text-xs">
            <button
              onClick={() => setMinQualityFilter(null)}
              className={`px-2 py-1 rounded transition-colors ${
                minQualityFilter === null
                  ? 'bg-background shadow-xs font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setMinQualityFilter(12)}
              className={`px-2 py-1 rounded transition-colors ${
                minQualityFilter === 12
                  ? 'bg-background shadow-xs font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Note Q ≥ 12
            </button>
            <button
              onClick={() => setMinQualityFilter(15)}
              className={`px-2 py-1 rounded transition-colors ${
                minQualityFilter === 15
                  ? 'bg-background shadow-xs font-medium text-emerald-400'
                  : 'text-emerald-500/70 hover:text-emerald-400'
              }`}
            >
              Note Q ≥ 15 ★
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-muted-foreground font-medium whitespace-nowrap">
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center gap-1">
                  <span>Action</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('weight')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Poids</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('marketCap')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Cap.</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground"
                onClick={() => handleSort('qualityScore')}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Note Q</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('operatingMargin')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Marge expl.</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('netMargin')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Marge nette</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('roic')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>ROIC</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('revenueGrowth')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Croiss. CA</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('peRatio')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>P/E</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('forwardPE')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Fwd P/E</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('pegRatio')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>PEG</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('peOnCost')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>P/E sur coût</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort('marketValue')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Valeur ({baseCurrency})</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 whitespace-nowrap font-mono text-[11px]">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={13}
                  className="py-8 text-center text-muted-foreground text-sm font-sans"
                >
                  Aucune position action trouvée.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((h) => {
                const qStyle = getQualityScoreStyle(h.qualityScore);

                return (
                  <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                    {/* Action with Logo */}
                    <td className="py-2.5 px-3 font-sans">
                      <div className="flex items-center gap-2.5">
                        <TickerLogo
                          symbol={h.symbol}
                          name={h.name}
                          exchangeMic={h.exchangeMic}
                          instrumentType={h.instrumentType}
                          size="sm"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground">{h.symbol}</span>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[120px] sm:max-w-[170px]">
                            {h.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Poids */}
                    <td className="py-2.5 px-3 text-right font-medium text-foreground font-sans">
                      {h.weight.toFixed(1)}%
                    </td>

                    {/* Capitalisation */}
                    <td className="py-2.5 px-3 text-right font-medium text-foreground text-[11px] font-sans">
                      {fmtMarketCap(h.marketCap)}
                    </td>

                    {/* Note Q */}
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span
                        style={{
                          backgroundColor: qStyle.bg,
                          color: qStyle.color,
                          borderColor: qStyle.border,
                        }}
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold border"
                      >
                        {h.qualityScore} / 20
                      </span>
                    </td>

                    {/* Marge d'exploitation */}
                    <td
                      style={{ color: getOperatingMarginColor(h.operatingMargin) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {fmtPercent(h.operatingMargin)}
                    </td>

                    {/* Marge nette */}
                    <td
                      style={{ color: getNetMarginColor(h.netMargin) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {fmtPercent(h.netMargin)}
                    </td>

                    {/* ROIC */}
                    <td
                      style={{ color: getRoicColor(h.roic) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {fmtPercent(h.roic)}
                    </td>

                    {/* Croissance CA */}
                    <td
                      style={{ color: getGrowthColor(h.revenueGrowth) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {fmtPercent(h.revenueGrowth)}
                    </td>

                    {/* P/E Actuel */}
                    <td
                      style={{ color: getPeColor(h.peRatio) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {fmtMultiple(h.peRatio)}
                    </td>

                    {/* Forward P/E */}
                    <td
                      style={{ color: getForwardPeColor(h.forwardPE) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {fmtMultiple(h.forwardPE)}
                    </td>

                    {/* PEG Ratio */}
                    <td
                      style={{ color: getPegColor(h.pegRatio) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {fmtMultiple(h.pegRatio)}
                    </td>

                    {/* P/E sur coût (PRU) */}
                    <td
                      style={{ color: getPeOnCostColor(h.peOnCost, h.peRatio) }}
                      className="py-2.5 px-3 text-right font-medium"
                    >
                      {fmtMultiple(h.peOnCost)}
                    </td>

                    {/* Valeur Portefeuille */}
                    <td className="py-2.5 px-3 text-right font-medium text-foreground font-sans">
                      {fmtCurrency(h.marketValue)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
