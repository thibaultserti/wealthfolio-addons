import React, { useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@wealthfolio/ui';
import { ChevronDown, Globe, Plus, Check } from 'lucide-react';
import { BENCHMARK_PRESETS } from '../utils/benchmark-utils';

interface BenchmarkSelectorProps {
  selectedSymbol: string;
  onSelectBenchmark: (symbol: string) => void;
}

export const BenchmarkSelector: React.FC<BenchmarkSelectorProps> = ({
  selectedSymbol,
  onSelectBenchmark,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const activePreset = BENCHMARK_PRESETS.find(
    (b) => b.symbol.toUpperCase() === selectedSymbol.toUpperCase(),
  );

  const displayLabel = activePreset ? activePreset.name : selectedSymbol || 'Select Benchmark';

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectBenchmark(customInput.trim().toUpperCase());
      setCustomInput('');
      setIsCustomOpen(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 h-9 px-3 text-sm font-medium">
          <Globe className="w-4 h-4 text-blue-500" />
          <span className="max-w-[150px] truncate">{displayLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1.5">
          Preset Benchmarks
        </DropdownMenuLabel>
        {BENCHMARK_PRESETS.map((preset) => {
          const isSelected = preset.symbol.toUpperCase() === selectedSymbol.toUpperCase();
          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => onSelectBenchmark(preset.symbol)}
              className="flex items-center justify-between cursor-pointer py-1.5 px-2"
            >
              <div className="flex flex-col">
                <span className="font-medium text-sm">{preset.name}</span>
                <span className="text-xs text-muted-foreground">{preset.description}</span>
              </div>
              {isSelected && <Check className="w-4 h-4 text-primary ml-2 shrink-0" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <div className="p-2">
          {!isCustomOpen ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground"
              onClick={() => setIsCustomOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Custom Benchmark Symbol
            </Button>
          ) : (
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
              <Input
                type="text"
                placeholder="e.g. QQQ, ^FCHI"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="h-8 text-xs font-mono"
                autoFocus
              />
              <Button type="submit" size="sm" className="h-8 px-2.5 text-xs">
                Set
              </Button>
            </form>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
