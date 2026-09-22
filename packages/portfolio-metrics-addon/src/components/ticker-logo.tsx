import React, { useState, useEffect } from 'react';

export interface TickerLogoProps {
  symbol: string;
  name?: string;
  exchangeMic?: string | null;
  instrumentType?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

// In-memory cache across components to avoid refetching blobs
const logoUrlCache = new Map<string, string | null>();

export function getLogoCacheKey(
  symbol: string,
  exchangeMic?: string | null,
  instrumentType?: string | null,
): string {
  const cleanSymbol = (symbol || '').trim().toUpperCase();
  const mic = (exchangeMic || '').trim().toUpperCase();
  const type = (instrumentType || '').trim().toUpperCase();
  return `${cleanSymbol}@${mic}@${type}`;
}

export const MIC_TO_SUFFIX: Record<string, string> = {
  XPAR: 'PA',
  XAMS: 'AS',
  XBRU: 'BR',
  XETR: 'DE',
  XFRA: 'F',
  XSTU: 'SG',
  XMIL: 'MI',
  XLON: 'L',
  XMAD: 'MC',
  XLIS: 'LS',
  XSWX: 'SW',
  XWBO: 'VI',
  XTSE: 'TO',
  XTSX: 'V',
  XASX: 'AX',
  XNZE: 'NZ',
  XTKS: 'T',
  XHKG: 'HK',
  XSES: 'SI',
  XKRX: 'KS',
  XTAE: 'TA',
  XJSE: 'JO',
  BVMF: 'SA',
  XMEX: 'MX',
};

export function clearLogoCache(): void {
  logoUrlCache.clear();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read blob'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const TickerLogo: React.FC<TickerLogoProps> = ({
  symbol,
  exchangeMic,
  instrumentType,
  className = '',
  size = 'sm',
}) => {
  const cleanSymbol = (symbol || '').trim().toUpperCase();
  const baseSymbol = cleanSymbol ? cleanSymbol.split(/[.:-]/)[0] : '';
  const cacheKey = getLogoCacheKey(cleanSymbol, exchangeMic, instrumentType);

  const sizeClasses = {
    xs: 'w-5 h-5 text-[8px] rounded-xs',
    sm: 'w-7 h-7 text-[10px] rounded-lg',
    md: 'w-8 h-8 text-[11px] rounded-lg',
    lg: 'w-10 h-10 text-xs rounded-xl',
  }[size];

  const [objectUrl, setObjectUrl] = useState<string | null>(() => {
    return logoUrlCache.get(cacheKey) ?? null;
  });
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!cleanSymbol) return;

    // Check memory cache
    const cached = logoUrlCache.get(cacheKey);
    if (cached !== undefined) {
      setObjectUrl(cached);
      return;
    }

    let isMounted = true;

    async function loadLogo() {
      const requestTickerLogo = (
        globalThis as unknown as {
          __wealthfolioRequestTickerLogo?: (
            sym: string,
            mic?: string | null,
            type?: string | null,
          ) => Promise<Blob | null>;
        }
      ).__wealthfolioRequestTickerLogo;

      if (typeof requestTickerLogo !== 'function') {
        if (isMounted) {
          logoUrlCache.set(cacheKey, null);
          setObjectUrl(null);
        }
        return;
      }

      let dataUrl: string | null = null;

      // 1. Primary call: In Wealthfolio 3.7+, this queries custom uploaded logos first,
      // and if none exist, resolves the market-aware / exchange-aware bundled logo.
      try {
        const blob = await requestTickerLogo(cleanSymbol, exchangeMic, instrumentType);
        if (blob && blob.size > 0) {
          dataUrl = await blobToDataUrl(blob);
        }
      } catch {
        // Continue to fallback
      }

      // 2. Targeted fallback for older hosts: only try the suffix matching the asset's actual exchange
      if (!dataUrl && exchangeMic && !cleanSymbol.includes('.')) {
        const suffix = MIC_TO_SUFFIX[exchangeMic.trim().toUpperCase()];
        if (suffix) {
          try {
            const suffixedBlob = await requestTickerLogo(`${baseSymbol}.${suffix}`);
            if (suffixedBlob && suffixedBlob.size > 0) {
              dataUrl = await blobToDataUrl(suffixedBlob);
            }
          } catch {
            // Ignore
          }
        }
      }

      // 3. Fallback to baseSymbol if different from cleanSymbol and still no logo
      if (!dataUrl && baseSymbol && baseSymbol !== cleanSymbol) {
        try {
          const baseBlob = await requestTickerLogo(baseSymbol);
          if (baseBlob && baseBlob.size > 0) {
            dataUrl = await blobToDataUrl(baseBlob);
          }
        } catch {
          // Ignore
        }
      }

      if (isMounted) {
        logoUrlCache.set(cacheKey, dataUrl);
        setObjectUrl(dataUrl);
      }
    }

    loadLogo();

    return () => {
      isMounted = false;
    };
  }, [cleanSymbol, baseSymbol, exchangeMic, instrumentType, cacheKey]);

  const displayText = baseSymbol.slice(0, 3) || 'STK';

  if (objectUrl && !hasError) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-background/80 border border-border/40 flex items-center justify-center p-1 shadow-2xs ${sizeClasses} ${className}`}
      >
        <img
          src={objectUrl}
          alt={cleanSymbol}
          onError={() => setHasError(true)}
          className="w-full h-full object-contain rounded-xs"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center font-bold tracking-tight bg-primary/10 text-primary border border-primary/20 select-none ${sizeClasses} ${className}`}
      title={cleanSymbol}
    >
      {displayText}
    </div>
  );
};
