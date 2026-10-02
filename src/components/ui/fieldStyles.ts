import { cx } from "../../lib/cx";

/** Border, background and focus ring shared by inputs, selects and textareas. */
export function controlClasses({ error, disabled }: { error?: boolean; disabled?: boolean }) {
  return cx(
    "w-full rounded-control text-body transition-[border-color,box-shadow] duration-(--duration-fast) outline-none placeholder:text-ink-subtle focus-visible:outline-none",
    disabled
      ? "cursor-not-allowed border border-line bg-sunken text-ink-subtle"
      : error
        ? "border-[1.5px] border-danger bg-surface text-ink focus:ring-3 focus:ring-danger-soft"
        : cx(
            "border border-control bg-surface text-ink hovered:border-ink-muted focus:border-brand focus:ring-3 focus:ring-brand-soft",
            // Frozen focus state for /dev/ui
            "data-[state~=focus]:border-brand data-[state~=focus]:ring-3 data-[state~=focus]:ring-brand-soft data-[state~=focus]:outline-none",
          ),
  );
}

/** aria-describedby for a control: the error wins over the helper text. */
export function describedBy(
  ids: { helperId: string; errorId: string },
  helper: unknown,
  error: unknown,
): string | undefined {
  if (error) return ids.errorId;
  if (helper) return ids.helperId;
  return undefined;
}
