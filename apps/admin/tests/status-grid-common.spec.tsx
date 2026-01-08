import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ChevronDown,
  ChevronRight,
  STATUS_CATEGORY_CONFIG,
  buildStatusCategories,
  ExpandableCategoryHeader,
} from '@/components/dashboard/status-grid-common';

describe('status-grid-common', () => {
  describe('ChevronDown', () => {
    it('renders SVG with default size', () => {
      const html = renderToStaticMarkup(<ChevronDown />);
      expect(html).toContain('svg');
      expect(html).toContain('width="16"');
      expect(html).toContain('height="16"');
    });

    it('renders SVG with custom size', () => {
      const html = renderToStaticMarkup(<ChevronDown size={24} />);
      expect(html).toContain('width="24"');
    });

    it('renders correct path for down chevron', () => {
      const html = renderToStaticMarkup(<ChevronDown />);
      expect(html).toContain('M6 9l6 6 6-6');
    });
  });

  describe('ChevronRight', () => {
    it('renders SVG with default size', () => {
      const html = renderToStaticMarkup(<ChevronRight />);
      expect(html).toContain('svg');
      expect(html).toContain('width="16"');
    });

    it('renders SVG with custom size', () => {
      const html = renderToStaticMarkup(<ChevronRight size={20} />);
      expect(html).toContain('width="20"');
    });

    it('renders correct path for right chevron', () => {
      const html = renderToStaticMarkup(<ChevronRight />);
      expect(html).toContain('M9 18l6-6-6-6');
    });
  });

  describe('STATUS_CATEGORY_CONFIG', () => {
    it('contains all expected categories', () => {
      expect(STATUS_CATEGORY_CONFIG.discovery).toBeDefined();
      expect(STATUS_CATEGORY_CONFIG.enrichment).toBeDefined();
      expect(STATUS_CATEGORY_CONFIG.review).toBeDefined();
      expect(STATUS_CATEGORY_CONFIG.published).toBeDefined();
      expect(STATUS_CATEGORY_CONFIG.terminal).toBeDefined();
    });

    it('has consistent structure for all categories', () => {
      for (const [_key, config] of Object.entries(STATUS_CATEGORY_CONFIG)) {
        expect(config.label).toBeDefined();
        expect(config.color).toMatch(/^text-/);
        expect(config.bgColor).toMatch(/^bg-/);
        expect(config.borderColor).toMatch(/^border-/);
      }
    });
  });

  describe('buildStatusCategories', () => {
    const mockStatusData = [
      { code: 100, name: 'Pending', category: 'discovery', count: 10 },
      { code: 101, name: 'Processing', category: 'discovery', count: 5 },
      { code: 200, name: 'Enriching', category: 'enrichment', count: 8 },
      { code: 300, name: 'In Review', category: 'review', count: 12 },
      { code: 400, name: 'Published', category: 'published', count: 50 },
      { code: 900, name: 'Rejected', category: 'terminal', count: 3 },
    ];

    it('builds categories with correct totals', () => {
      const result = buildStatusCategories({
        statusData: mockStatusData,
        order: ['discovery', 'enrichment', 'review', 'published', 'terminal'],
        config: STATUS_CATEGORY_CONFIG,
      });

      expect(result).toHaveLength(5);
      expect(result[0].category).toBe('discovery');
      expect(result[0].total).toBe(15); // 10 + 5
      expect(result[1].total).toBe(8);
      expect(result[2].total).toBe(12);
      expect(result[3].total).toBe(50);
      expect(result[4].total).toBe(3);
    });

    it('sorts statuses by code within categories', () => {
      const result = buildStatusCategories({
        statusData: mockStatusData,
        order: ['discovery'],
        config: STATUS_CATEGORY_CONFIG,
      });

      expect(result[0].statuses[0].code).toBe(100);
      expect(result[0].statuses[1].code).toBe(101);
    });

    it('handles empty status data', () => {
      const result = buildStatusCategories({
        statusData: [],
        order: ['discovery', 'enrichment'],
        config: STATUS_CATEGORY_CONFIG,
      });

      expect(result).toHaveLength(2);
      expect(result[0].total).toBe(0);
      expect(result[0].statuses).toHaveLength(0);
    });

    it('handles undefined status data', () => {
      const result = buildStatusCategories({
        statusData: undefined as unknown as typeof mockStatusData,
        order: ['discovery'],
        config: STATUS_CATEGORY_CONFIG,
      });

      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(0);
    });

    it('includes config properties in result', () => {
      const result = buildStatusCategories({
        statusData: mockStatusData,
        order: ['discovery'],
        config: STATUS_CATEGORY_CONFIG,
      });

      expect(result[0].label).toBe('Discovery');
      expect(result[0].color).toBe('text-violet-400');
      expect(result[0].bgColor).toBe('bg-violet-500/10');
      expect(result[0].borderColor).toBe('border-violet-500/30');
    });
  });

  describe('ExpandableCategoryHeader', () => {
    it('renders label and total', () => {
      const html = renderToStaticMarkup(
        <ExpandableCategoryHeader
          label="Discovery"
          total={25}
          color="text-violet-400"
          isExpanded={false}
          onToggle={() => {}}
        />,
      );

      expect(html).toContain('Discovery');
      expect(html).toContain('25');
    });

    it('shows ChevronRight when collapsed', () => {
      const html = renderToStaticMarkup(
        <ExpandableCategoryHeader
          label="Discovery"
          total={25}
          color="text-violet-400"
          isExpanded={false}
          onToggle={() => {}}
        />,
      );

      // ChevronRight path
      expect(html).toContain('M9 18l6-6-6-6');
    });

    it('shows ChevronDown when expanded', () => {
      const html = renderToStaticMarkup(
        <ExpandableCategoryHeader
          label="Discovery"
          total={25}
          color="text-violet-400"
          isExpanded={true}
          onToggle={() => {}}
        />,
      );

      // ChevronDown path
      expect(html).toContain('M6 9l6 6 6-6');
    });

    it('renders as button', () => {
      const html = renderToStaticMarkup(
        <ExpandableCategoryHeader
          label="Discovery"
          total={25}
          color="text-violet-400"
          isExpanded={false}
          onToggle={() => {}}
        />,
      );

      expect(html).toContain('<button');
    });
  });
});
