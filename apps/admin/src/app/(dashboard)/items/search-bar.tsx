'use client';

import { useSearchNavigation } from './use-search-navigation';
import { SearchInput } from './search-input';
import { SearchButton } from './search-button';

export function SearchBar() {
  const { query, setQuery, handleSearch, handleClear } = useSearchNavigation();

  return (
    <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
      <SearchInput query={query} onChange={setQuery} onClear={handleClear} />
      <SearchButton />
    </form>
  );
}
