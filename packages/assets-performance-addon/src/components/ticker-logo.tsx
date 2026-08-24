import React, { useState, useEffect } from 'react';

interface TickerLogoProps {
  symbol: string;
  name?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

// In-memory object URL cache across components to avoid refetching blobs
const logoUrlCache = new Map<string, string | null>();

export const TickerLogo: React.FC<TickerLogoProps> = ({ symbol, className = '', size = 'md' }) => {
  const cleanSymbol = (symbol || '').trim().toUpperCase();
  const baseSymbol = cleanSymbol ? cleanSymbol.split(/[.:-]/)[0] : '';

  const sizeClasses = {
    xs: 'w-5 h-5 text-[8px] rounded-xs',
    sm: 'w-6 h-6 text-[9px] rounded-md',
    md: 'w-8 h-8 text-[11px] rounded-lg',
    lg: 'w-10 h-10 text-xs rounded-xl',
  }[size];

  const [objectUrl, setObjectUrl] = useState<string | null>(() => {
    return logoUrlCache.get(cleanSymbol) ?? logoUrlCache.get(baseSymbol) ?? null;
  });
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!cleanSymbol) return;

    // Check memory cache
    const cached =
      logoUrlCache.get(cleanSymbol) ?? (baseSymbol ? logoUrlCache.get(baseSymbol) : undefined);
    if (cached !== undefined) {
      setObjectUrl(cached);
      return;
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

    let isMounted = true;

    async function loadLogo() {
      const requestTickerLogo = (
        globalThis as unknown as {
          __wealthfolioRequestTickerLogo?: (sym: string) => Promise<Blob | null>;
        }
      ).__wealthfolioRequestTickerLogo;

      const candidates = Array.from(
        new Set([
          cleanSymbol,
          baseSymbol,
          `${baseSymbol}.PA`,
          `${cleanSymbol}.PA`,
          `${baseSymbol}.DE`,
          `${baseSymbol}.AS`,
          `${baseSymbol}.MI`,
          `${baseSymbol}.L`,
          `${baseSymbol}.US`,
        ]),
      ).filter((s): s is string => !!s && s.length > 0);

      let dataUrl: string | null = null;

      if (typeof requestTickerLogo === 'function') {
        for (const candidate of candidates) {
          try {
            const blob = await requestTickerLogo(candidate);
            if (blob && blob.size > 0) {
              dataUrl = await blobToDataUrl(blob);
              break;
            }
          } catch {
            // Try next candidate
          }
        }
      }

      if (isMounted) {
        if (dataUrl) {
          logoUrlCache.set(cleanSymbol, dataUrl);
          if (baseSymbol) logoUrlCache.set(baseSymbol, dataUrl);
          setObjectUrl(dataUrl);
        } else {
          logoUrlCache.set(cleanSymbol, null);
          setObjectUrl(null);
        }
      }
    }

    loadLogo();

    return () => {
      isMounted = false;
    };
  }, [cleanSymbol, baseSymbol]);

  const displayText = baseSymbol.slice(0, 4) || 'STK';

  if (objectUrl && !hasError) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-background/80 border border-border/40 flex items-center justify-center p-0.5 shadow-2xs ${sizeClasses} ${className}`}
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
      className={`shrink-0 flex items-center justify-center font-bold font-mono tracking-tight bg-primary/10 text-primary border border-primary/20 select-none ${sizeClasses} ${className}`}
      title={cleanSymbol}
    >
      {displayText}
    </div>
  );
};
