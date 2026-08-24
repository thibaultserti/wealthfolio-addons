import { describe, it, expect } from 'vitest';
import { computeAnnualizedReturn, computeXirr, computeHoldingPerformance } from './irr-twr-utils';

describe('irr-twr-utils', () => {
  describe('computeAnnualizedReturn', () => {
    it('returns null for missing inputs or duration < 2 days', () => {
      expect(computeAnnualizedReturn(null, '2024-01-01')).toBeNull();
      expect(computeAnnualizedReturn(0.1, null)).toBeNull();
      expect(computeAnnualizedReturn(0.1, new Date(), new Date())).toBeNull();
    });

    it('correctly annualizes a 2-year return of +21%', () => {
      const openDate = '2022-01-01';
      const endDate = '2024-01-01'; // exactly 2 years (730 days)
      const res = computeAnnualizedReturn(0.21, openDate, endDate);
      // (1 + 0.21)^(1/2) - 1 ≈ 0.10 (10%)
      expect(res).toBeCloseTo(0.1, 2);
    });

    it('correctly annualizes a 6-month return of +10%', () => {
      const openDate = '2024-01-01';
      const endDate = '2024-07-01'; // ~0.5 year
      const res = computeAnnualizedReturn(0.1, openDate, endDate);
      // (1 + 0.10)^2 - 1 ≈ 0.21
      expect(res).toBeGreaterThan(0.2);
    });
  });

  describe('computeXirr', () => {
    it('returns null for insufficient or invalid cash flows', () => {
      expect(computeXirr([])).toBeNull();
      expect(computeXirr([{ date: '2024-01-01', amount: -100 }])).toBeNull();
      // All positive or all negative
      expect(
        computeXirr([
          { date: '2024-01-01', amount: -100 },
          { date: '2024-06-01', amount: -200 },
        ]),
      ).toBeNull();
    });

    it('correctly calculates XIRR for a simple buy and sell after 1 year (+10%)', () => {
      const flows = [
        { date: '2023-01-01', amount: -1000 },
        { date: '2024-01-01', amount: 1100 },
      ];
      const irr = computeXirr(flows);
      expect(irr).not.toBeNull();
      expect(irr!).toBeCloseTo(0.1, 2);
    });

    it('correctly computes XIRR with intermittent dividends', () => {
      const flows = [
        { date: '2023-01-01', amount: -1000 },
        { date: '2023-07-01', amount: 50 }, // Dividend
        { date: '2024-01-01', amount: 1050 }, // Terminal value
      ];
      const irr = computeXirr(flows);
      expect(irr).not.toBeNull();
      // Total gain: $100 on $1000 with early dividend -> slightly > 10%
      expect(irr!).toBeGreaterThan(0.1);
    });
  });

  describe('computeHoldingPerformance', () => {
    it('returns selected-period returns for holdings < 1 year', () => {
      const openDate = '2024-01-01';
      const endDate = '2024-06-01'; // 152 days (< 365)
      const res = computeHoldingPerformance({
        totalReturnPct: 0.15,
        openDate,
        endDate,
      });

      expect(res.isAnnualized).toBe(false);
      expect(res.displayTwr).toBe(0.15);
      expect(res.twrLabelKey).toBe('twr');
    });

    it('returns annualized returns for holdings >= 1 year', () => {
      const openDate = '2022-01-01';
      const endDate = '2024-01-01'; // 2 years
      const res = computeHoldingPerformance({
        totalReturnPct: 0.21,
        openDate,
        endDate,
      });

      expect(res.isAnnualized).toBe(true);
      expect(res.displayTwr).toBeCloseTo(0.1, 2);
      expect(res.twrLabelKey).toBe('annualized_twr');
    });
  });
});
