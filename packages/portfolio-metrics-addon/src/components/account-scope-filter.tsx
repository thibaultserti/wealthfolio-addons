import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HostAPI, Account } from '@wealthfolio/addon-sdk';
import type { AccountScope } from '../types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wealthfolio/ui';
import { ChevronDown, Folder, Layers, Wallet } from 'lucide-react';

interface AccountScopeFilterProps {
  api: HostAPI;
  scope: AccountScope;
  onScopeChange: (scope: AccountScope) => void;
}

export const AccountScopeFilter: React.FC<AccountScopeFilterProps> = ({
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
          {scope.type === 'account' && <Wallet className="w-4 h-4 text-blue-500" />}
          <span className="truncate max-w-[140px] sm:max-w-[200px]">{triggerLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
        {/* All Portfolios */}
        <DropdownMenuItem
          onClick={() => onScopeChange({ type: 'all', label: 'All Portfolios' })}
          className={`flex items-center gap-2 cursor-pointer font-medium ${
            scope.type === 'all' ? 'bg-accent font-semibold' : ''
          }`}
        >
          <Layers className="w-4 h-4 text-primary" />
          <span>All Portfolios</span>
          <span className="ml-auto text-xs text-muted-foreground">({activeAccounts.length})</span>
        </DropdownMenuItem>

        {/* Portfolios (Groups) Section */}
        {groupPortfolios.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1">
                Portfolios
              </DropdownMenuLabel>
              {groupPortfolios.map((groupName) => {
                const count = activeAccounts.filter((a) => a.group === groupName).length;
                const isSelected =
                  (scope.type === 'group' || scope.type === 'portfolio') && scope.id === groupName;
                return (
                  <DropdownMenuItem
                    key={`group-${groupName}`}
                    onClick={() =>
                      onScopeChange({
                        type: 'group',
                        id: groupName,
                        label: groupName,
                      })
                    }
                    className={`flex items-center gap-2 cursor-pointer ${
                      isSelected ? 'bg-accent font-semibold' : ''
                    }`}
                  >
                    <Folder className="w-4 h-4 text-amber-500" />
                    <span className="truncate">{groupName}</span>
                    <span className="ml-auto text-xs text-muted-foreground">({count})</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        )}

        {/* Individual Accounts Section */}
        {activeAccounts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1">
                Individual Accounts
              </DropdownMenuLabel>
              {activeAccounts.map((account) => {
                const isSelected = scope.type === 'account' && scope.id === account.id;
                return (
                  <DropdownMenuItem
                    key={`account-${account.id}`}
                    onClick={() =>
                      onScopeChange({
                        type: 'account',
                        id: account.id,
                        label: account.name,
                      })
                    }
                    className={`flex items-center gap-2 cursor-pointer ${
                      isSelected ? 'bg-accent font-semibold' : ''
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-blue-500" />
                    <div className="flex flex-col truncate min-w-0">
                      <span className="truncate">{account.name}</span>
                      {account.group && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {account.group}
                        </span>
                      )}
                    </div>
                    {account.currency && (
                      <span className="ml-auto text-[10px] text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded">
                        {account.currency}
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
