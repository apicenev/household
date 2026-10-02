import { cx } from "../../lib/cx";

/** Ring spinner in the current text colour (16 px), as in the loading buttons. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block size-4 shrink-0 animate-spinner rounded-pill border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}
