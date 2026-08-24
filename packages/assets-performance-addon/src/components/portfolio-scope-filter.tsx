import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HostAPI, Account } from '@wealthfolio/addon-sdk';
import type { PortfolioScope } from '../types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wealthfolio/ui';
import { ChevronDown, Folder, Layers, Wallet } from 'lucide-react';

interface PortfolioScopeFilterProps {
  api: HostAPI;
  scope: PortfolioScope;
  onScopeChange: (scope: PortfolioScope) => void;
}

export const PortfolioScopeFilter: React.FC<PortfolioScopeFilterProps> = ({
  api,
  scope,
  onScopeChange,
}) => {
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-scope-list'],
    queryFn: async () => {
      try {
        return await api.accounts.getAll();
      } catch {
        return [] as Account[];
      }
    },
    staleTime: 300_000,
  });

  const activeAccounts = accounts.filter((a) => !a.isArchived);

  // Group portfolios (defined via account.group)
  const groupPortfolios = Array.from(
    new Set(activeAccounts.map((a) => a.group).filter((g): g is string => Boolean(g && g.trim()))),
  );

  let triggerLabel = 'All Portfolios';
  if (scope.type === 'group' || scope.type === 'portfolio') {
    triggerLabel = `Portfolio: ${scope.label || scope.id}`;
  } else if (scope.type === 'account') {
    const acc = activeAccounts.find((a) => a.id === scope.id);
    triggerLabel = acc ? acc.name : scope.label || 'Account';
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 h-9 px-3 text-sm font-medium">
          {scope.type === 'all' && <Layers className="w-4 h-4 text-primary" />}
          {(scope.type === 'group' || scope.type === 'portfolio') && (
            <Folder className="w-4 h-4 text-amber-500" />
          )}
          {scope.type === 'account' && <Wallet className="w-4 h-4 text-emerald-500" />}
          <span className="max-w-[160px] truncate">{triggerLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
          Filter Scope
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onScopeChange({ type: 'all', label: 'All Portfolios' })}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-medium">All Portfolios</span>
        </DropdownMenuItem>

        {groupPortfolios.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
              Portfolios & Groups
            </DropdownMenuLabel>
            {groupPortfolios.map((group) => (
              <DropdownMenuItem
                key={group}
                onClick={() => onScopeChange({ type: 'group', id: group, label: group })}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Folder className="w-4 h-4 text-amber-500" />
                <span>{group}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {activeAccounts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
              Individual Accounts
            </DropdownMenuLabel>
            {activeAccounts.map((acc) => (
              <DropdownMenuItem
                key={acc.id}
                onClick={() => onScopeChange({ type: 'account', id: acc.id, label: acc.name })}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Wallet className="w-4 h-4 text-emerald-500" />
                <span className="truncate">{acc.name}</span>
                {acc.currency && (
                  <span className="ml-auto text-xs text-muted-foreground font-mono">
                    {acc.currency}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
