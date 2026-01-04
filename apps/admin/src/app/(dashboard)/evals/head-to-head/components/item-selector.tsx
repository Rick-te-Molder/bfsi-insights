'use client';

import { getItemLabel } from '../utils';

interface StatusItem {
  code: number;
  name: string;
}

export function StatusFilterSelect({
  value,
  onChange,
  statuses,
}: {
  value: string;
  onChange: (v: string) => void;
  statuses: StatusItem[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-32 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white text-sm"
    >
      <option value="">All statuses</option>
      {statuses.map((s) => (
        <option key={s.code} value={s.code}>
          {s.code} {s.name}
        </option>
      ))}
    </select>
  );
}

export function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search items..."
      className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white placeholder:text-neutral-500"
    />
  );
}

export function ItemList({
  items,
  selectedItem,
  setSelectedItem,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  selectedItem: string;
  setSelectedItem: (v: string) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLSelectElement>) => {
    const t = e.target as HTMLOptionElement;
    if (t.value) setSelectedItem(t.value);
  };

  return (
    <select
      value={selectedItem}
      onChange={(e) => setSelectedItem(e.target.value)}
      onClick={handleClick}
      className="w-full mt-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white cursor-pointer"
      size={5}
    >
      <ItemOptions items={items} />
    </select>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ItemOptions({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <option value="" disabled>
        No items match filters
      </option>
    );
  }

  return (
    <>
      {items.map((item) => {
        const label = getItemLabel(item);
        const displayLabel = label.length > 100 ? label.substring(0, 100) + '...' : label;
        return (
          <option key={item.id} value={item.id} title={label}>
            {displayLabel}
          </option>
        );
      })}
    </>
  );
}

interface ItemSelectorProps {
  statuses: StatusItem[];
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedItem: string;
  setSelectedItem: (v: string) => void;
  filteredItems: { id: string }[];
}

function FilterRow({
  statuses,
  statusFilter,
  setStatusFilter,
  setSelectedItem,
  searchQuery,
  setSearchQuery,
}: ItemSelectorProps) {
  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    setSelectedItem('');
  };
  return (
    <div className="flex gap-2">
      <StatusFilterSelect value={statusFilter} onChange={handleStatusChange} statuses={statuses} />
      <SearchInput value={searchQuery} onChange={setSearchQuery} />
    </div>
  );
}

export function ItemSelector(props: ItemSelectorProps) {
  return (
    <div className="lg:col-span-2">
      <span className="block text-sm text-neutral-400 mb-1">Test Item</span>
      <FilterRow {...props} />
      <ItemList
        items={props.filteredItems}
        selectedItem={props.selectedItem}
        setSelectedItem={props.setSelectedItem}
      />
    </div>
  );
}
