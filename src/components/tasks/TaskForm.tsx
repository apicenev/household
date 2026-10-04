import { ArrowsRightLeftIcon } from "@heroicons/react/16/solid";
import { FlagIcon, TrashIcon } from "@heroicons/react/20/solid";
import { useId, type FormEvent } from "react";
import { ruleFromPicker } from "../../domain/recurrence";
import { MAX_TASK_NOTES, MAX_TASK_TITLE } from "../../domain/tasks";
import { priorityLabels, recurrenceCopy, taskCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { describeRuleInSentence } from "../../lib/recurrenceFormat";
import type { Member, TaskPriority, WeekStart } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { DateField } from "../ui/DateField";
import { RecurrencePicker } from "../ui/RecurrencePicker";
import { RotationPicker } from "../ui/RotationPicker";
import { SegmentedControl } from "../ui/SegmentedControl";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import { Toggle } from "../ui/Toggle";
import {
  isRepeating,
  withAssignee,
  withDueDate,
  withRepeat,
  withRotationOrder,
  withRotationSwitch,
  type TaskFormValues,
} from "./taskFormValues";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

const priorityIcon: Record<TaskPriority, string> = {
  low: "text-priority-low",
  medium: "text-priority-medium",
  high: "text-priority-high",
};

export interface TaskFormProps {
  formId: string;
  values: TaskFormValues;
  onChange: (patch: Partial<TaskFormValues>) => void;
  titleError?: string;
  /** Focus the title first («Neue Aufgabe»). */
  autoFocusTitle: boolean;
  /** Focus «Wiederholen» first (Schnellerfassung chip, D31). */
  autoFocusRepeat?: boolean;
  members: Member[];
  /** Household time zone, for the date field and its quick picks. */
  timeZone: string;
  /** Today in the household time zone (D26). */
  today: string;
  weekStartsOn: WeekStart;
  /** Household default order of new rotations (HH-07, B11). */
  rotationOrder?: string[];
  desktop: boolean;
  /** Validates and saves; also called by Enter in the title (the button may be disabled). */
  onSubmit: () => void;
  /** Phones: «Aufgabe löschen» below the fields (edit only). */
  onDelete?: () => void;
}

/**
 * The fields of «Neue Aufgabe» / «Aufgabe bearbeiten» (`Sheets.dc.html`): Titel, Notizen,
 * Zuständig, Fällig am, Priorität, then «Wiederholen» and «Abwechseln» (Phase 4). Phones: one
 * column; desktop: the two-column dialog, repeat and rotation on the right. The submit buttons
 * live in the sheet footer (`form` attribute).
 */
export function TaskForm({
  formId,
  values,
  onChange,
  titleError,
  autoFocusTitle,
  autoFocusRepeat = false,
  members,
  timeZone,
  today,
  weekStartsOn,
  rotationOrder,
  desktop,
  onSubmit,
  onDelete,
}: TaskFormProps) {
  const assigneeLabelId = useId();
  const priorityLabelId = useId();
  const rotationLabelId = useId();
  const repeating = isRepeating(values);
  const canRotate = repeating && members.length >= 2;
  const nameOf = (uid: string) => members.find((member) => member.uid === uid)?.displayName;
  const rotationNames = (values.rotation ?? []).map(nameOf).filter(Boolean) as string[];

  const assigneeOptions: Array<{ id: string | null; member?: Member; label: string }> = [
    ...members.map((member) => ({ id: member.uid, member, label: member.displayName })),
    { id: null, label: taskCopy.nobody },
  ];

  const basics = (
    <>
      <TextField
        label={taskCopy.title}
        value={values.title}
        onChange={(event) => onChange({ title: event.target.value })}
        maxLength={MAX_TASK_TITLE}
        error={titleError}
        autoComplete="off"
        enterKeyHint="done"
        onKeyDown={(event) => {
          // Implicit submission doesn't happen while the button is disabled (empty title),
          // but Enter should still show «Gib der Aufgabe einen Namen.».
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        data-autofocus={autoFocusTitle && !autoFocusRepeat ? true : undefined}
      />
      <Textarea
        label={taskCopy.notes}
        value={values.notes}
        onChange={(event) => onChange({ notes: event.target.value })}
        maxLength={MAX_TASK_NOTES}
        showCount={false}
        rows={2}
      />
      <div className="flex flex-col gap-2">
        <span id={assigneeLabelId} className="text-body-sm font-semibold text-ink">
          {terms.assignee}
        </span>
        <div role="group" aria-labelledby={assigneeLabelId} className="flex flex-wrap gap-2">
          {assigneeOptions.map((option) => {
            const selected = values.assigneeId === option.id;
            return (
              <button
                key={option.id ?? "nobody"}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(withAssignee(values, option.id))}
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-pill font-semibold transition-colors duration-(--duration-fast)",
                  desktop ? "h-10 pr-3 pl-1.25 text-body-sm" : "h-11 pr-3.5 pl-1.5 text-[15px]",
                  selected
                    ? "bg-brand-soft text-brand-strong inset-ring-[1.5px] inset-ring-brand"
                    : "bg-surface text-ink inset-ring inset-ring-line-strong hovered:bg-sunken",
                )}
              >
                {option.member ? (
                  <Avatar
                    initials={option.member.initials}
                    color={option.member.avatarColor}
                    size={desktop ? 30 : 32}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={cx(
                      "shrink-0 rounded-pill border-[1.5px] border-dashed border-control",
                      desktop ? "size-7.5" : "size-8",
                    )}
                  />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
        {canRotate && rotationNames.length >= 2 && (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
            <ArrowsRightLeftIcon aria-hidden="true" className="size-4 shrink-0" />
            {recurrenceCopy.rotationOn(rotationNames[0], rotationNames[1])}
          </span>
        )}
      </div>
      <DateField
        label={taskCopy.dueOn}
        value={values.dueDate}
        onChange={(dueDate) => onChange(withDueDate(values, dueDate))}
        quickPicks
        noDatePick
        noDateDisabled={repeating}
        clearable={!repeating}
        timeZone={timeZone}
      />
      <div className="flex flex-col gap-2">
        <span
          id={priorityLabelId}
          aria-hidden="true"
          className="text-body-sm font-semibold text-ink"
        >
          {taskCopy.priority}
        </span>
        <SegmentedControl
          aria-label={taskCopy.priority}
          value={values.priority}
          onChange={(priority) => onChange({ priority })}
          options={PRIORITIES.map((priority) => ({
            value: priority,
            label: priorityLabels[priority],
            icon: <FlagIcon aria-hidden="true" className={cx("size-4", priorityIcon[priority])} />,
          }))}
        />
      </div>
    </>
  );

  const anchor = values.dueDate || today;
  const rule = ruleFromPicker(values.repeat, anchor);
  const rotationSummary =
    rule && rotationNames.length >= 2
      ? `${values.title.trim() || terms.task} · ${describeRuleInSentence(rule, weekStartsOn)} · ${rotationNames.join(" → ")}`
      : undefined;

  const repeatSection = (
    <>
      <RecurrencePicker
        value={values.repeat}
        onChange={(repeat) => onChange(withRepeat(values, repeat, today, weekStartsOn))}
        dueDate={anchor}
        weekStartsOn={weekStartsOn}
        autoFocus={autoFocusRepeat}
      />
      {canRotate && (
        <div
          className={cx(
            "flex flex-col border-t border-line",
            desktop ? "gap-2.5 pt-3.5" : "gap-3 pt-4",
          )}
        >
          <div className={cx("flex items-center gap-3", !desktop && "min-h-13")}>
            <span className="flex flex-1 flex-col gap-0.5">
              <span id={rotationLabelId} className="text-body-sm font-semibold text-ink">
                {recurrenceCopy.rotation}
              </span>
              {!desktop && (
                <span className="text-[13px] leading-[18px] text-ink-muted">
                  {recurrenceCopy.rotationHint}
                </span>
              )}
            </span>
            <Toggle
              checked={values.rotation !== null}
              onChange={(on) => onChange(withRotationSwitch(values, on, rotationOrder, members))}
              aria-labelledby={rotationLabelId}
            />
          </div>
          {values.rotation && (
            <>
              <RotationPicker
                order={values.rotation}
                onChange={(order) => onChange(withRotationOrder(order))}
                members={members}
                variant={desktop ? "chips" : "list"}
                firstBadge={recurrenceCopy.thisTime}
                aria-label={recurrenceCopy.rotation}
              />
              {rotationSummary &&
                (desktop ? (
                  <span className="text-[13px] text-ink-muted">{rotationSummary}</span>
                ) : (
                  <span className="flex min-h-8 items-center gap-1.5 self-start rounded-pill bg-brand-soft py-1.5 pr-3 pl-2.5 text-[13px] font-semibold text-brand-strong">
                    <ArrowsRightLeftIcon aria-hidden="true" className="size-4 shrink-0" />
                    {rotationSummary}
                  </span>
                ))}
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <form
      id={formId}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
      className={desktop ? "grid grid-cols-2" : "flex flex-col gap-5"}
    >
      {desktop ? (
        <>
          <div className="flex min-w-0 flex-col gap-4.5 border-r border-line px-6 py-5">
            {basics}
          </div>
          <div className="flex min-w-0 flex-col gap-4.5 px-6 py-5">{repeatSection}</div>
        </>
      ) : (
        <>
          {basics}
          {repeatSection}
          {onDelete && (
            <Button
              variant="danger-ghost"
              icon={TrashIcon}
              onClick={onDelete}
              className="self-start"
            >
              {taskCopy.deleteTask}
            </Button>
          )}
        </>
      )}
    </form>
  );
}
