import { describe, it, expect, beforeEach } from 'vitest';
import { getLogoCacheKey, MIC_TO_SUFFIX, clearLogoCache } from './ticker-logo';

describe('TickerLogo Helper & Resolution Logic', () => {
  beforeEach(() => {
    clearLogoCache();
    delete (globalThis as unknown as Record<string, unknown>).__wealthfolioRequestTickerLogo;
  });

  it('generates distinct cache keys for same symbol on different exchanges', () => {
    const keyParis = getLogoCacheKey('DG', 'XPAR');
    const keyNyse = getLogoCacheKey('DG', 'XNYS');
    const keyNoMic = getLogoCacheKey('DG');

    expect(keyParis).toBe('DG@XPAR@');
    expect(keyNyse).toBe('DG@XNYS@');
    expect(keyNoMic).toBe('DG@@');
    expect(keyParis).not.toBe(keyNyse);
    expect(keyParis).not.toBe(keyNoMic);
  });

  it('includes instrumentType in cache key when provided', () => {
    const keyCrypto = getLogoCacheKey('BTC', undefined, 'CRYPTO');
    const keyEquity = getLogoCacheKey('BTC', 'XNAS', 'EQUITY');

    expect(keyCrypto).toBe('BTC@@CRYPTO');
    expect(keyEquity).toBe('BTC@XNAS@EQUITY');
  });

  it('maps major stock exchanges to their correct ticker logo suffix', () => {
    expect(MIC_TO_SUFFIX['XPAR']).toBe('PA'); // Euronext Paris
    expect(MIC_TO_SUFFIX['XAMS']).toBe('AS'); // Euronext Amsterdam
    expect(MIC_TO_SUFFIX['XBRU']).toBe('BR'); // Euronext Brussels
    expect(MIC_TO_SUFFIX['XETR']).toBe('DE'); // Deutsche Boerse XETRA
    expect(MIC_TO_SUFFIX['XMIL']).toBe('MI'); // Borsa Italiana Milan
    expect(MIC_TO_SUFFIX['XLON']).toBe('L'); // London Stock Exchange
    expect(MIC_TO_SUFFIX['XMAD']).toBe('MC'); // Bolsa de Madrid
    expect(MIC_TO_SUFFIX['XTSE']).toBe('TO'); // Toronto Stock Exchange
  });
});
