import { useRef, type ComponentType, type KeyboardEvent, type SVGProps } from "react";
import { cx } from "../../lib/cx";

export interface Choice<T extends string> {
  value: T;
  title: string;
  text: string;
  /** 24/outline icon in the 48 px tile. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Large selectable cards with radio semantics (`Auth Onboarding` → Auswahl): one tab stop,
 * arrow keys move and select. Selected: 2 px brand ring, brand icon tile, filled radio dot.
 */
export function ChoiceCards<T extends string>({
  choices,
  value,
  onChange,
  "aria-labelledby": labelledBy,
  className,
}: {
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-labelledby": string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = choices.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = index === last ? 0 : index + 1;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    onChange(choices[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cx("flex flex-col gap-3", className)}
    >
      {choices.map((choice, index) => {
        const selected = choice.value === value;
        const Icon = choice.icon;
        return (
          <button
            key={choice.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(choice.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cx(
              "flex cursor-pointer items-center gap-3.5 rounded-card bg-surface px-4 py-4.5 text-left text-ink shadow-card transition-shadow duration-(--duration-fast)",
              selected && "ring-2 ring-brand",
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "flex size-12 shrink-0 items-center justify-center rounded-[14px] transition-colors duration-(--duration-fast)",
                selected ? "bg-brand text-on-brand" : "bg-brand-soft text-brand",
              )}
            >
              <Icon className="size-6" />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-heading">{choice.title}</span>
              <span className="text-body-sm text-ink-muted">{choice.text}</span>
            </span>
            <span
              aria-hidden="true"
              className={cx(
                "size-6 shrink-0 rounded-pill transition-[border-width,border-color] duration-(--duration-fast)",
                selected ? "border-7 border-brand" : "border-2 border-control",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
