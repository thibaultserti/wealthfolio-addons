import { describe, it, expect } from 'vitest';
import { getPerformanceGradient } from './assets-table';

describe('getPerformanceGradient', () => {
  it('handles null, undefined and non-finite values gracefully', () => {
    expect(getPerformanceGradient(null).className).toContain('text-muted-foreground');
    expect(getPerformanceGradient(undefined).className).toContain('text-muted-foreground');
    expect(getPerformanceGradient(NaN).className).toContain('text-muted-foreground');
  });

  it('handles neutral 0.00% value', () => {
    const neutral = getPerformanceGradient(0);
    expect(neutral.className).toContain('text-muted-foreground');
    expect(neutral.className).toContain('bg-muted/40');
  });

  it('generates emerald gradient styles for positive returns with increasing intensity', () => {
    const lowGain = getPerformanceGradient(0.05); // +5%
    const medGain = getPerformanceGradient(0.25); // +25%
    const highGain = getPerformanceGradient(0.75); // +75% (capped at factor 1.0)

    expect(lowGain.className).toContain('text-emerald-600');
    expect(medGain.className).toContain('text-emerald-700');
    expect(highGain.className).toContain('text-emerald-700');
    expect(highGain.className).toContain('font-bold');

    expect(lowGain.style.backgroundColor).toContain('rgba(16, 185, 129');
    expect(highGain.style.backgroundColor).toBe('rgba(16, 185, 129, 0.350)');
  });

  it('generates rose/red gradient styles for negative returns with increasing intensity', () => {
    const lowLoss = getPerformanceGradient(-0.03); // -3%
    const medLoss = getPerformanceGradient(-0.18); // -18%
    const highLoss = getPerformanceGradient(-0.45); // -45% (capped at factor 1.0)

    expect(lowLoss.className).toContain('text-rose-600');
    expect(medLoss.className).toContain('text-rose-700');
    expect(highLoss.className).toContain('text-rose-700');
    expect(highLoss.className).toContain('font-bold');

    expect(lowLoss.style.backgroundColor).toContain('rgba(239, 68, 68');
    expect(highLoss.style.backgroundColor).toBe('rgba(239, 68, 68, 0.350)');
  });
});
