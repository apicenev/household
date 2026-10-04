import { useId } from "react";
import { taskCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";

export type SeriesChoice = "one" | "all";

/**
 * «Nur diese» / «Ganze Serie» radio cards of the recurring-task delete dialog (`Sheets` →
 * «Aufgabe löschen Serie», `Components` → alertdialog; RTK-08). Native radios, so the arrow
 * keys move between the two.
 */
export function SeriesDeleteChoice({
  value,
  onChange,
  oneHint,
  allHint,
}: {
  value: SeriesChoice;
  onChange: (value: SeriesChoice) => void;
  oneHint: string;
  allHint: string;
}) {
  const name = useId();
  const options: Array<{ key: SeriesChoice; label: string; hint: string }> = [
    { key: "one", label: taskCopy.series.one, hint: oneHint },
    { key: "all", label: taskCopy.series.all, hint: allHint },
  ];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{taskCopy.series.choiceLabel}</legend>
      {options.map((option) => {
        const checked = value === option.key;
        return (
          <label
            key={option.key}
            className={cx(
              "flex min-h-15 cursor-pointer items-center gap-3 rounded-control px-4 text-ink lg:min-h-14 lg:px-3.5",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid",
              checked
                ? "bg-danger-soft shadow-[inset_0_0_0_1.5px_var(--color-danger)]"
                : "bg-sunken",
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
                checked ? "border-[7px] border-danger" : "border-2 border-control",
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
