import { useId } from "react";
import { taskCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";

export type SeriesChoice = "one" | "all";

/**
 * «Nur diese» / «Ganze Serie» radio cards of the recurring-task delete dialog (`Sheets` →
 * «Aufgabe löschen Serie», `Components` → alertdialog; RTK-08). Native radios, so the arrow
 * keys move between the two. Events (Phase 9 D92) pass their own labels; the edit choice uses
 * the brand tone instead of danger.
 */
export function SeriesDeleteChoice({
  value,
  onChange,
  oneHint,
  allHint,
  labels = { one: taskCopy.series.one, all: taskCopy.series.all },
  legend = taskCopy.series.choiceLabel,
  tone = "danger",
}: {
  value: SeriesChoice;
  onChange: (value: SeriesChoice) => void;
  oneHint: string;
  allHint: string;
  labels?: { one: string; all: string };
  legend?: string;
  tone?: "danger" | "brand";
}) {
  const name = useId();
  const options: Array<{ key: SeriesChoice; label: string; hint: string }> = [
    { key: "one", label: labels.one, hint: oneHint },
    { key: "all", label: labels.all, hint: allHint },
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const checked = value === option.key;
        return (
          <label
            key={option.key}
            className={cx(
              "flex min-h-15 cursor-pointer items-center gap-3 rounded-control px-4 text-ink lg:min-h-14 lg:px-3.5",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid",
              !checked && "bg-sunken",
              checked &&
                (tone === "danger"
                  ? "bg-danger-soft shadow-[inset_0_0_0_1.5px_var(--color-danger)]"
                  : "bg-brand-soft shadow-[inset_0_0_0_1.5px_var(--color-brand)]"),
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.key}
              checked={checked}
              onChange={() => onChange(option.key)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cx(
                "size-5.5 shrink-0 rounded-pill",
                !checked && "border-2 border-control",
                checked &&
                  (tone === "danger" ? "border-[7px] border-danger" : "border-[7px] border-brand"),
              )}
            />
            <span className="flex flex-col">
              <span className="text-body font-semibold lg:text-[15px]">{option.label}</span>
              <span className="text-[13px] text-ink-muted">{option.hint}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
