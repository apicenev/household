import { HomeModernIcon } from "@heroicons/react/24/solid";
import { cx } from "../../lib/cx";

/**
 * Brand tile: home-modern on brand. 36 px (sidebar, radius 10) / 48 px (login, radius 14) /
 * 56 px (app start, radius-control).
 */
export function BrandTile({ size = 36, className }: { size?: 36 | 48 | 56; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center bg-brand text-on-brand",
        size === 36 && "size-9 rounded-[10px]",
        size === 48 && "size-12 rounded-[14px]",
        size === 56 && "size-14 rounded-control",
        className,
      )}
    >
      <HomeModernIcon className={size === 36 ? "size-5" : "size-6"} />
    </span>
  );
}
