import type { TaxonomyConfig, TaxonomyData } from '@/components/tags';
import type { QueueItem } from '@bfsi/types';
import { ItemContent } from './ItemContent';

export type RenderItemListProps = {
  listItems: QueueItem[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  taxonomyConfig: TaxonomyConfig[];
  taxonomyData: TaxonomyData;
};

export function renderItemList(props: RenderItemListProps) {
  const { listItems, selectedId, setSelectedId, taxonomyConfig, taxonomyData } = props;

  const getAudienceLabel = createAudienceLabelGetter(taxonomyConfig, taxonomyData);
  const renderItemButton = createItemButton(selectedId, setSelectedId, getAudienceLabel);

  return (
    <div className="w-1/2 flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
      <ItemListHeader count={listItems.length} />
      <ItemListBody items={listItems} renderItemButton={(item) => renderItemButton({ item })} />
    </div>
  );
}

function createAudienceLabelGetter(taxonomyConfig: TaxonomyConfig[], taxonomyData: TaxonomyData) {
  return (audienceCode: string): string => {
    const config = taxonomyConfig.find(
      (c) => c.behavior_type === 'scoring' && c.payload_field === `audience_scores.${audienceCode}`,
    );
    if (config) {
      const lookupData = taxonomyData[config.slug];
      if (lookupData) {
        const match = lookupData.find((item) => item.code === audienceCode);
        if (match) return match.name;
      }
    }
    return audienceCode.charAt(0).toUpperCase() + audienceCode.slice(1).replace('_', ' ');
  };
}

function createItemButton(
  selectedId: string | null,
  setSelectedId: (id: string) => void,
  getAudienceLabel: (code: string) => string,
) {
  const ItemButton = createBaseItemButton();
  const RenderedItemButton = ({ item }: { item: QueueItem }) => (
    <ItemButton
      item={item}
      onClick={() => setSelectedId(item.id)}
      getAudienceLabel={getAudienceLabel}
      className={createButtonClassName(selectedId, item.id)}
    />
  );

  RenderedItemButton.displayName = 'RenderedItemButton';

  return RenderedItemButton;
}

function createBaseItemButton() {
  const ItemButton = ({
    item,
    onClick,
    className,
    getAudienceLabel,
  }: {
    item: QueueItem;
    onClick: () => void;
    className: string;
    getAudienceLabel: (code: string) => string;
  }) => (
    <button key={item.id} onClick={onClick} className={className}>
      <ItemContent item={item} getAudienceLabel={getAudienceLabel} />
    </button>
  );

  ItemButton.displayName = 'ItemButton';

  return ItemButton;
}

function createButtonClassName(selectedId: string | null, itemId: string) {
  return `w-full text-left p-3 transition-colors ${
    selectedId === itemId
      ? 'bg-sky-600/20 border-l-2 border-sky-500'
      : 'hover:bg-neutral-800/50 border-l-2 border-transparent'
  }`;
}

function ItemListHeader({ count }: { count: number }) {
  return (
    <div className="flex-shrink-0 border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
      <span className="text-sm font-medium text-neutral-300">{count} items</span>
      <span className="text-xs text-neutral-500">Click to select • ↑↓ to navigate</span>
    </div>
  );
}

function ItemListBody({
  items,
  renderItemButton,
}: {
  items: QueueItem[];
  renderItemButton: (item: QueueItem) => React.ReactElement;
}) {
  return (
    <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/50">
      {items.length === 0 ? (
        <div className="p-8 text-center text-neutral-500">No items found</div>
      ) : (
        items.map(renderItemButton)
      )}
    </div>
  );
}
