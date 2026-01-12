import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from '@/lib/utils';

describe('date-utils', () => {
  describe('formatDate', () => {
    it('formats full date (YYYY-MM-DD) with day', () => {
      const result = formatDate('2025-10-15');
      expect(result).toMatch(/Oct.*15.*2025/);
    });

    it('formats month-year only (YYYY-MM) without day', () => {
      const result = formatDate('2025-10');
      expect(result).toMatch(/Oct.*2025/);
      expect(result).not.toMatch(/\d{1,2},/); // Should not have a day number
    });

    it('handles January correctly for month-year format', () => {
      const result = formatDate('2025-01');
      expect(result).toMatch(/Jan.*2025/);
    });

    it('handles December correctly for month-year format', () => {
      const result = formatDate('2025-12');
      expect(result).toMatch(/Dec.*2025/);
    });
  });

  describe('formatDateTime', () => {
    it('formats full date with time', () => {
      const result = formatDateTime('2025-10-15T14:30:00');
      expect(result).toMatch(/Oct.*15.*2025/);
    });

    it('formats month-year only (YYYY-MM) without day or time', () => {
      const result = formatDateTime('2025-10');
      expect(result).toMatch(/Oct.*2025/);
      expect(result).not.toMatch(/\d{1,2}:/); // Should not have time
    });

    it('handles edge case months correctly', () => {
      expect(formatDateTime('2025-01')).toMatch(/Jan.*2025/);
      expect(formatDateTime('2025-12')).toMatch(/Dec.*2025/);
    });
  });
});
