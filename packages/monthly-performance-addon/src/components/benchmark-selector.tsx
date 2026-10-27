import React, { useState } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';
import type { BenchmarkPreset } from '../types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@wealthfolio/ui';
import { ChevronDown, Globe, Search, TrendingUp, X } from 'lucide-react';

interface BenchmarkSelectorProps {
  api: HostAPI;
  benchmarkSymbol: string | null;
  onBenchmarkChange: (symbol: string | null) => void;
}

const PRESET_BENCHMARKS: BenchmarkPreset[] = [
  { id: 'SPY', name: 'S&P 500 ETF (SPY)', symbol: 'SPY', category: 'US Large Cap' },
  { id: 'QQQ', name: 'Nasdaq 100 ETF (QQQ)', symbol: 'QQQ', category: 'US Tech' },
  { id: 'URTH', name: 'MSCI World ETF (URTH)', symbol: 'URTH', category: 'Global' },
  { id: 'CW8.PA', name: 'Amundi MSCI World (CW8.PA)', symbol: 'CW8.PA', category: 'Global EUR' },
  { id: 'VT', name: 'Vanguard Total World (VT)', symbol: 'VT', category: 'Global' },
  { id: 'VTI', name: 'Vanguard Total Stock US (VTI)', symbol: 'VTI', category: 'US Broad' },
  { id: '^GSPC', name: 'S&P 500 Index (^GSPC)', symbol: '^GSPC', category: 'Index' },
];

export const BenchmarkSelector: React.FC<BenchmarkSelectorProps> = ({
  api,
  benchmarkSymbol,
  onBenchmarkChange,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [searchResults, setSearchResults] = useState<{ symbol: string; name?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setCustomInput(query);
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await api.market.searchTicker(query.trim());
      setSearchResults(
        results.slice(0, 5).map((r) => ({
          symbol: r.symbol,
          name: r.shortName || r.longName || r.symbol,
        })),
      );
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (symbol: string | null) => {
    onBenchmarkChange(symbol);
    setCustomInput('');
    setSearchResults([]);
  };

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 h-9 px-3 text-sm font-medium"
          >
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="truncate max-w-[140px] sm:max-w-[180px]">
              {benchmarkSymbol ? `vs ${benchmarkSymbol}` : 'Benchmark'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2">
          {/* Quick Search */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ticker (e.g. SPY, AAPL)..."
              value={customInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-8 pl-8 text-xs font-mono"
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-2">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Search Results
                </DropdownMenuLabel>
                {searchResults.map((res) => (
                  <DropdownMenuItem
                    key={res.symbol}
                    onClick={() => handleSelect(res.symbol)}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <span className="font-semibold">{res.symbol}</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                      {res.name}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </div>
          )}

          <DropdownMenuItem
            onClick={() => handleSelect(null)}
            className="flex items-center gap-2 text-xs py-1.5 font-medium text-muted-foreground"
          >
            <span>No Benchmark (Portfolio only)</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Popular Presets
            </DropdownMenuLabel>

            {PRESET_BENCHMARKS.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => handleSelect(preset.symbol)}
                className="flex items-center justify-between text-xs py-1.5"
              >
                <div className="flex items-center gap-2 truncate">
                  <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-semibold">{preset.symbol}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{preset.name}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {benchmarkSymbol && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleSelect(null)}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="Remove benchmark"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
