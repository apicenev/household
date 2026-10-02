import { useId, useRef, type KeyboardEvent } from "react";
import { avatarColorNames } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { AvatarColor } from "../../types";

const colors: AvatarColor[] = [1, 2, 3, 4, 5, 6, 7, 8];

const swatchColors: Record<AvatarColor, string> = {
  1: "bg-avatar-1 text-avatar-1-ink",
  2: "bg-avatar-2 text-avatar-2-ink",
  3: "bg-avatar-3 text-avatar-3-ink",
  4: "bg-avatar-4 text-avatar-4-ink",
  5: "bg-avatar-5 text-avatar-5-ink",
  6: "bg-avatar-6 text-avatar-6-ink",
  7: "bg-avatar-7 text-avatar-7-ink",
  8: "bg-avatar-8 text-avatar-8-ink",
};

/**
 * «Avatarfarbe»: the 8 avatar colours as a radio group (one tab stop, arrow keys move and
 * select). Each swatch is named for screen readers («Taubenblau»); the selected one shows the
 * initials and a 2 px brand ring. Phones: 8 equal columns; desktop: 40 px circles.
 */
export function AvatarColorPicker({
  value,
  initials,
  onChange,
}: {
  value: AvatarColor;
  initials: string;
  onChange: (color: AvatarColor) => void;
}) {
  const labelId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = colors.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = index === last ? 0 : index + 1;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    onChange(colors[next]);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-body-sm font-semibold text-ink">
        Avatarfarbe
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid grid-cols-8 gap-1 lg:flex lg:gap-2"
      >
        {colors.map((color, index) => {
          const selected = color === value;
          return (
            <button
              key={color}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={avatarColorNames[color]}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(color)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cx(
                "flex h-10 cursor-pointer items-center justify-center rounded-pill text-caption font-[650] lg:w-10",
                swatchColors[color],
                selected && "ring-2 ring-brand ring-offset-2 ring-offset-surface",
              )}
            >
              <span aria-hidden="true">{selected ? initials : ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
