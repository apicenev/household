import type { ItemStat, ShopCategory, ShoppingItem } from "../types";

/**
 * Shopping list rules (Phase 5): name normalisation, duplicates, grouping, suggestions and
 * quantities. Pure functions; the rules in firestore.rules mirror `statKey`.
 */

export const ITEM_NAME_MAX = 100;
export const ITEM_QUANTITY_MAX = 30;
export const ITEM_NOTES_MAX = 500;

/** Group order of the list (B8). */
export const SHOP_CATEGORY_ORDER: readonly ShopCategory[] = [
  "groceries",
  "household",
  "pharmacy",
  "other",
];

/** Category of a never-bought item (SHP-02, B5). */
export const DEFAULT_SHOP_CATEGORY: ShopCategory = "groceries";

/**
 * The spelling that gets saved (B3): Unicode NFC, every whitespace character (NBSP, thin and
 * ideographic spaces, tabs, …) becomes a plain space, then trimmed with runs collapsed. Case
 * is kept. Stored names therefore only contain single ASCII spaces, which the rules (RE2,
 * ASCII-only `\s`) handle the same way as the client.
 */
export function cleanName(name: string): string {
  return name.normalize("NFC").replace(/\s+/gu, " ").trim();
}

/** Comparison form (B3): cleaned and lowercased, locale-independent like the rules' lower(). */
export function normalizeName(name: string): string {
  return cleanName(name).toLowerCase();
}

/** The itemStats doc id (B3): the normalised name; `/` can't be in an id, so it becomes `∕`. */
export function statKey(name: string): string {
  return normalizeName(name).replaceAll("/", "∕");
}

export type ItemNameProblem = "empty" | "tooLong" | "reserved";

/**
 * Why a name can't be saved, or null. «Reserved»: names whose key Firestore doesn't accept
 * as a document id («.», «..», «__x__»).
 */
export function validateItemName(name: string): ItemNameProblem | null {
  const cleaned = cleanName(name);
  if (cleaned.length === 0) return "empty";
  if (cleaned.length > ITEM_NAME_MAX) return "tooLong";
  const key = statKey(cleaned);
  if (key === "." || key === ".." || /^__.*__$/u.test(key)) return "reserved";
  return null;
}

/** Normalised names of the open items, for duplicate checks and suggestions. */
export function openItemKeys(items: readonly ShoppingItem[]): Set<string> {
  return new Set(items.filter((item) => !item.checked).map((item) => statKey(item.name)));
}

/**
 * The open item with the same normalised name, or null (SHP-08, B4). `exceptId` leaves out
 * the item being renamed.
 */
export function findOpenDuplicate(
  name: string,
  items: readonly ShoppingItem[],
  exceptId?: string,
): ShoppingItem | null {
  const key = statKey(name);
  return (
    items.find((item) => !item.checked && item.id !== exceptId && statKey(item.name) === key) ??
    null
  );
}

/** The checked item with the same normalised name, re-added instead of a new one (B4). */
export function findChecked(name: string, items: readonly ShoppingItem[]): ShoppingItem | null {
  const key = statKey(name);
  return items.find((item) => item.checked && statKey(item.name) === key) ?? null;
}

export interface ItemGroup {
  category: ShopCategory;
  items: ShoppingItem[];
}

function byCreation(a: ShoppingItem, b: ShoppingItem): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

/**
 * Open items grouped by category (SHP-05, B8): fixed group order, empty groups left out,
 * oldest first within a group (new items at the bottom).
 */
export function groupByCategory(items: readonly ShoppingItem[]): ItemGroup[] {
  const open = items.filter((item) => !item.checked);
  return SHOP_CATEGORY_ORDER.map((category) => ({
    category,
    items: open.filter((item) => item.category === category).sort(byCreation),
  })).filter((group) => group.items.length > 0);
}

/** The «Gekauft» section (SHP-04, B8): latest purchase first. */
export function sortChecked(items: readonly ShoppingItem[]): ShoppingItem[] {
  const time = (item: ShoppingItem) => item.checkedAt?.getTime() ?? 0;
  return items
    .filter((item) => item.checked)
    .sort((a, b) => time(b) - time(a) || a.id.localeCompare(b.id));
}

/** Open items (top bar and sidebar count, B13). */
export function openItemCount(items: readonly ShoppingItem[]): number {
  return items.filter((item) => !item.checked).length;
}

/** §8.5: most purchases first, then most recent; the name keeps the order stable. */
function byRank(a: ItemStat, b: ItemStat): number {
  return (
    b.count - a.count ||
    b.lastPurchasedAt.getTime() - a.lastPurchasedAt.getTime() ||
    a.key.localeCompare(b.key)
  );
}

function candidates(stats: readonly ItemStat[], openKeys: ReadonlySet<string>): ItemStat[] {
  return stats.filter((stat) => stat.count > 0 && !openKeys.has(statKey(stat.name)));
}

/**
 * Suggestions while typing (SHP-07, B9): previously bought names containing the query, not
 * on the list; prefix matches first, then by rank.
 */
export function suggest(
  query: string,
  stats: readonly ItemStat[],
  openKeys: ReadonlySet<string>,
  limit = 4,
): ItemStat[] {
  const q = normalizeName(query);
  if (!q) return [];
  const matches = candidates(stats, openKeys).filter((stat) =>
    normalizeName(stat.name).includes(q),
  );
  const isPrefix = (stat: ItemStat) => normalizeName(stat.name).startsWith(q);
  return matches
    .sort((a, b) => Number(isPrefix(b)) - Number(isPrefix(a)) || byRank(a, b))
    .slice(0, limit);
}

/** Whether the ««…» hinzufügen» row shows: unless a suggestion is exactly the input (B9). */
export function showAddRow(query: string, suggestions: readonly ItemStat[]): boolean {
  const q = normalizeName(query);
  return q.length > 0 && !suggestions.some((stat) => normalizeName(stat.name) === q);
}

/** «Oft gekauft» (SHP-07, B9): the top items by rank that aren't on the list. */
export function frequentItems(
  stats: readonly ItemStat[],
  openKeys: ReadonlySet<string>,
  n = 5,
): ItemStat[] {
  return candidates(stats, openKeys).sort(byRank).slice(0, n);
}

/** Category for a new item (B5): the last purchase's, otherwise Lebensmittel. */
export function categoryFor(name: string, stats: readonly ItemStat[]): ShopCategory {
  const key = statKey(name);
  return stats.find((stat) => stat.key === key)?.category ?? DEFAULT_SHOP_CATEGORY;
}

/** Units of the quantity stepper in the Artikel-Sheet (B2). «Stk.» isn't written out. */
export const QUANTITY_UNITS = ["Stk.", "l", "kg", "Pack."] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export const QUANTITY_MAX = 999;

export interface Quantity {
  amount: number;
  unit: QuantityUnit;
}

/** «2» (Stk.), «2 l», «2 kg», «2 Pack.» (B2). */
export function formatQuantity({ amount, unit }: Quantity): string {
  return unit === "Stk." ? String(amount) : `${amount} ${unit}`;
}

/**
 * The stepper value of a stored quantity, or null when the stepper can't show it («500 g»,
 * «1 Packung»; B2), so the sheet leaves it untouched.
 */
export function parseQuantity(text: string | undefined): Quantity | null {
  const match = /^([1-9][0-9]{0,2})(?: (l|kg|Pack\.))?$/u.exec(text ?? "");
  if (!match) return null;
  return { amount: Number(match[1]), unit: (match[2] as QuantityUnit | undefined) ?? "Stk." };
}

/**
 * What a pending local write is (D44): «new» while the created item hasn't reached the server
 * (both times are the same local estimate), «checked» for a pending check-off, otherwise
 * «other». Null when nothing is pending.
 */
export function pendingKind(item: ShoppingItem): "new" | "checked" | "other" | null {
  if (!item.hasPendingWrites) return null;
  if (item.checked) return "checked";
  if (item.createdAt.getTime() === item.updatedAt.getTime()) return "new";
  return "other";
}

export type ItemWriteIntent = "add" | "edit" | "check" | "uncheck" | "delete";

/**
 * Whether the item already is where a rejected write wanted it, so the rejection stays
 * silent (as Phase 3 D21): someone else checked, unchecked or deleted it first.
 */
export function isItemWriteOutcomeReached(
  item: ShoppingItem | undefined,
  intent: ItemWriteIntent,
): boolean {
  switch (intent) {
    case "check":
      return item?.checked === true;
    case "uncheck":
      return item !== undefined && !item.checked;
    case "delete":
      return item === undefined;
    default:
      return false;
  }
}
