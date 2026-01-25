import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDOMElements,
  indexListData,
} from '../../../features/publications/multi-select-filters.dom';

describe('multi-select-filters.dom', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('getDOMElements', () => {
    it('returns null for missing elements', () => {
      const elements = getDOMElements();

      expect(elements.list).toBeNull();
      expect(elements.empty).toBeNull();
      expect(elements.countEl).toBeNull();
      expect(elements.qEl).toBeNull();
      expect(elements.filterChipsEl).toBeNull();
      expect(elements.searchSpinner).toBeNull();
      expect(elements.loadMoreBtn).toBeNull();
      expect(elements.paginationCount).toBeNull();
      expect(elements.paginationContainer).toBeNull();
      expect(elements.loadingSkeleton).toBeNull();
      expect(elements.filterPanel).toBeNull();
      expect(elements.panelBackdrop).toBeNull();
      expect(elements.closeFilterPanelBtn).toBeNull();
      expect(elements.openPanelBtn).toBeNull();
      expect(elements.clearAllBtn).toBeNull();
      expect(elements.applyFiltersBtn).toBeNull();
      expect(elements.panelCountNumber).toBeNull();
      expect(elements.fabFilterCount).toBeNull();
      expect(elements.fabIcon).toBeNull();
      expect(elements.fabSpinner).toBeNull();
      expect(elements.sortSelect).toBeNull();
      expect(elements.emptyClearFilters).toBeNull();
      expect(elements.emptyClearSearch).toBeNull();
    });

    it('returns elements when present in DOM', () => {
      document.body.innerHTML = `
        <div id="list"></div>
        <div id="empty"></div>
        <div id="count"></div>
        <input id="q" type="text" />
        <div id="filter-chips"></div>
        <button id="load-more-btn"></button>
        <select id="sort-select"></select>
      `;

      const elements = getDOMElements();

      expect(elements.list).not.toBeNull();
      expect(elements.empty).not.toBeNull();
      expect(elements.countEl).not.toBeNull();
      expect(elements.qEl).toBeInstanceOf(HTMLInputElement);
      expect(elements.filterChipsEl).not.toBeNull();
      expect(elements.loadMoreBtn).toBeInstanceOf(HTMLButtonElement);
      expect(elements.sortSelect).toBeInstanceOf(HTMLSelectElement);
    });
  });

  describe('indexListData', () => {
    it('indexes list items with data attributes', () => {
      const list = document.createElement('ul');
      list.innerHTML = `
        <li data-industry="banking" data-topic="ai" data-authors="John Doe" data-summary-medium="Summary text">
          <h3>Article Title</h3>
          <div class="mt-1">Source Name</div>
        </li>
        <li data-industry="insurance" data-date_published="2024-01-01">
          <a>Link Title</a>
        </li>
      `;

      const data = indexListData(list);

      expect(data.length).toBe(2);
      expect(data[0].title).toBe('Article Title');
      expect(data[0].industry).toBe('banking');
      expect(data[0].topic).toBe('ai');
      expect(data[0].authors).toBe('John Doe');
      expect(data[0].summary).toBe('Summary text');
      expect(data[0].source_name).toBe('Source Name');

      expect(data[1].title).toBe('Link Title');
      expect(data[1].industry).toBe('insurance');
      expect(data[1].date_published).toBe('2024-01-01');
    });

    it('handles empty list', () => {
      const list = document.createElement('ul');
      const data = indexListData(list);
      expect(data.length).toBe(0);
    });

    it('extracts all data attributes', () => {
      const list = document.createElement('ul');
      list.innerHTML = `
        <li 
          data-role="analyst"
          data-industry="banking"
          data-topic="ai"
          data-content_type="report"
          data-geography="us"
          data-regulator="sec"
          data-regulation="mifid"
          data-obligation="kyc"
          data-process="onboarding"
          data-date_published="2024-01-01"
          data-date_added="2024-01-02"
        >
          <h3>Test</h3>
        </li>
      `;

      const data = indexListData(list);

      expect(data[0].role).toBe('analyst');
      expect(data[0].industry).toBe('banking');
      expect(data[0].topic).toBe('ai');
      expect(data[0].content_type).toBe('report');
      expect(data[0].geography).toBe('us');
      expect(data[0].regulator).toBe('sec');
      expect(data[0].regulation).toBe('mifid');
      expect(data[0].obligation).toBe('kyc');
      expect(data[0].process).toBe('onboarding');
      expect(data[0].date_published).toBe('2024-01-01');
      expect(data[0].date_added).toBe('2024-01-02');
    });
  });
});
