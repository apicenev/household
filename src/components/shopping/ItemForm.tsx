import { CheckIcon, MinusIcon, PlusIcon } from "@heroicons/react/20/solid";
import { useId, type FormEvent } from "react";
import {
  ITEM_NAME_MAX,
  ITEM_NOTES_MAX,
  QUANTITY_MAX,
  QUANTITY_UNITS,
  SHOP_CATEGORY_ORDER,
  type QuantityUnit,
} from "../../domain/shopping";
import { shoppingCopy } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { shopCategories } from "../ui/categories";
import { SegmentedControl } from "../ui/SegmentedControl";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { canStepDown, stepDown, stepUp, withUnit, type ItemFormValues } from "./itemFormValues";

/**
 * The fields of «Artikel bearbeiten» (`Sheets.dc.html` → Artikel-Sheet): Name, Menge
 * (stepper + units, B2, D37), Kategorie (radio cards) and Notizen. The buttons live in the
 * sheet footer (`form` attribute).
 */
export function ItemForm({
  formId,
  values,
  onChange,
  nameError,
  onSubmit,
}: {
  formId: string;
  values: ItemFormValues;
  onChange: (values: ItemFormValues) => void;
  nameError?: string;
  /** Validates and saves; also called by Enter in the name. */
  onSubmit: () => void;
}) {
  const quantityLabelId = useId();
  const categoryName = useId();
  const quantity = values.quantity;
  const legacy = !values.quantityTouched ? values.legacyQuantity : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        label={shoppingCopy.name}
        value={values.name}
        onChange={(event) => onChange({ ...values, name: event.target.value })}
        error={nameError}
        maxLength={ITEM_NAME_MAX}
        autoComplete="off"
        enterKeyHint="done"
      />

      <div role="group" aria-labelledby={quantityLabelId} className="flex flex-col gap-2">
        <span id={quantityLabelId} className="text-body-sm font-semibold text-ink">
          {shoppingCopy.quantity}
        </span>
        <div className="flex items-center gap-2.5">
          <div className="flex shrink-0 items-center rounded-control inset-ring inset-ring-control">
            <button
              type="button"
              aria-label={shoppingCopy.less}
              disabled={!canStepDown(values)}
              onClick={() => onChange(stepDown(values))}
              className="flex size-12 cursor-pointer items-center justify-center rounded-control text-ink disabled:cursor-not-allowed disabled:text-ink-subtle"
            >
              <MinusIcon aria-hidden="true" className="size-5" />
            </button>
            <output
              aria-live="polite"
              className="min-w-9 text-center text-[18px] font-semibold text-ink tabular-nums"
            >
              {quantity ? quantity.amount : shoppingCopy.noQuantity}
            </output>
            <button
              type="button"
              aria-label={shoppingCopy.more}
              disabled={quantity !== null && quantity.amount >= QUANTITY_MAX}
              onClick={() => onChange(stepUp(values))}
              className="flex size-12 cursor-pointer items-center justify-center rounded-control text-ink disabled:cursor-not-allowed disabled:text-ink-subtle"
            >
              <PlusIcon aria-hidden="true" className="size-5" />
            </button>
          </div>
          <SegmentedControl<QuantityUnit>
            aria-label={shoppingCopy.unit}
            value={quantity?.unit ?? "Stk."}
            onChange={(unit) => onChange(withUnit(values, unit))}
            disabled={quantity === null}
            options={QUANTITY_UNITS.map((unit) => ({ value: unit, label: unit }))}
            className="min-w-0 flex-1"
          />
        </div>
        {legacy && (
          <span className="text-[13px] text-ink-muted">
            {shoppingCopy.previousQuantity(legacy)}
          </span>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-sm font-semibold text-ink">
          {shoppingCopy.category}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {SHOP_CATEGORY_ORDER.map((category) => {
            const style = shopCategories[category];
            const Icon = style.icon;
            const checked = values.category === category;
            return (
              <label
                key={category}
                className={cx(
                  "flex h-13 cursor-pointer items-center gap-2.5 rounded-control px-3 text-[15px] font-semibold text-ink",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid",
                  checked
                    ? "bg-brand-soft inset-ring-[1.5px] inset-ring-brand"
                    : "bg-surface inset-ring inset-ring-line-strong hovered:bg-sunken",
                )}
              >
                <input
                  type="radio"
                  name={categoryName}
                  value={category}
                  checked={checked}
                  onChange={() => onChange({ ...values, category })}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cx(
                    "flex size-7.5 shrink-0 items-center justify-center rounded-[8px]",
                    style.soft,
                    style.main,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{style.label}</span>
                {checked && <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-brand" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      <Textarea
        label={shoppingCopy.notes}
        value={values.notes}
        onChange={(event) => onChange({ ...values, notes: event.target.value })}
        maxLength={ITEM_NOTES_MAX}
        rows={2}
      />
    </form>
  );
}
