import { ShoppingBagIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { AddItemBar } from "../components/shopping/AddItemBar";
import { FrequentItems } from "../components/shopping/FrequentItems";
import { BoughtItemRow, ItemRow } from "../components/shopping/ItemRow";
import { BoughtSection, ItemGroupSection } from "../components/shopping/ItemSections";
import { useShopping } from "../components/shopping/shoppingContext";
import { useItemCheckOff } from "../components/shopping/useItemCheckOff";
import { EmptyState } from "../components/ui/EmptyState";
import { InlineAlert } from "../components/ui/InlineAlert";
import { SkeletonList } from "../components/ui/Skeleton";
import {
  frequentItems,
  groupByCategory,
  openItemCount,
  openItemKeys,
  sortChecked,
} from "../domain/shopping";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useAuth } from "../lib/auth/useAuth";
import { actions as actionLabels, areas, shoppingCopy } from "../lib/copy";
import { useLoadedHousehold } from "../lib/household/useHousehold";

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/**
 * /shopping «Einkauf» (`Shopping.dc.html`, SHP-01…09): the add field with suggestions and
 * «Oft gekauft» (sticky on phones), the open items grouped by category, and «Gekauft (n)»
 * with «Gekaufte entfernen». Desktop: header with the summary (D42), list left, «Oft gekauft»
 * and «Gekauft» right.
 */
export default function ShoppingPage() {
  const { members, items, itemsLoading, itemsError, retryItems, itemStats, memberById } =
    useLoadedHousehold();
  const { user } = useAuth();
  const { actions, openEditItem } = useShopping();
  const desktop = useIsDesktop();
  const { checking, toggle } = useItemCheckOff(items, actions);
  useDocumentTitle(areas.shopping);

  const uid = user?.uid ?? "";
  const ready = !itemsLoading && !itemsError;
  const groups = groupByCategory(items);
  const bought = sortChecked(items);
  const frequent = ready ? frequentItems(itemStats, openItemKeys(items)) : [];
  const others = members
    .filter((member) => member.uid !== uid)
    .map((member) => firstName(member.displayName));
  // «von Anna» (B10); nothing for someone who isn't a member any more.
  const buyerName = (memberId: string | undefined) => {
    const member = memberId ? memberById(memberId) : undefined;
    return member ? firstName(member.displayName) : undefined;
  };

  const frequentSection = (
    <FrequentItems
      stats={frequent}
      desktop={desktop}
      onAdd={(name, category) => actions.add(name, category)}
    />
  );

  function list(): ReactNode {
    if (itemsError) {
      return (
        <InlineAlert tone="danger" action={{ label: actionLabels.retry, onClick: retryItems }}>
          {shoppingCopy.loadError}
        </InlineAlert>
      );
    }
    if (itemsLoading) return <SkeletonList rows={4} />;
    if (groups.length === 0) {
      return (
        <EmptyState
          icon={ShoppingBagIcon}
          title={shoppingCopy.empty}
          text={shoppingCopy.emptyText}
          card={desktop}
          className={desktop ? undefined : "px-5 py-8"}
        />
      );
    }
    const sections = groups.map(({ category, items: groupItems }) => (
      <ItemGroupSection key={category} category={category} count={groupItems.length}>
        {groupItems.map((item, index) => (
          <ItemRow
            key={item.id}
            item={item}
            desktop={desktop}
            checking={checking.has(item.id)}
            onToggle={() => toggle(item.id)}
            onOpen={() => openEditItem(item.id)}
            first={index === 0}
          />
        ))}
      </ItemGroupSection>
    ));
    return desktop ? (
      <div className="grid grid-cols-2 items-start gap-5">{sections}</div>
    ) : (
      sections
    );
  }

  const boughtSection = ready && bought.length > 0 && (
    <BoughtSection count={bought.length} onClear={actions.clearCompleted}>
      {bought.map((item, index) => (
        <BoughtItemRow
          key={item.id}
          item={item}
          buyerName={buyerName(item.checkedBy)}
          desktop={desktop}
          onUncheck={() => actions.uncheck(item)}
          onOpen={() => openEditItem(item.id)}
          first={index === 0}
        />
      ))}
    </BoughtSection>
  );

  if (desktop) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-[40px] leading-[46px] font-medium tracking-[-0.015em] text-ink">
            {areas.shopping}
          </h1>
          {ready && (
            <p className="text-[15px] text-ink-muted">
              {shoppingCopy.summary(openItemCount(items), bought.length, others)}
            </p>
          )}
        </header>
        <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-5">
            <AddItemBar desktop />
            {list()}
          </div>
          <div className="flex flex-col gap-5">
            {frequentSection}
            {boughtSection}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Phones show «Einkauf · 4 offen» in the top bar; the h1 stays for screen readers. */}
      <h1 className="sr-only">{areas.shopping}</h1>
      <div className="sticky top-[calc(env(safe-area-inset-top)+--spacing(14))] z-10 -mx-4 -mt-1 flex flex-col gap-3 bg-canvas px-4 pt-1 pb-2">
        <AddItemBar desktop={false} />
        {frequentSection}
      </div>
      {list()}
      {boughtSection}
    </div>
  );
}
