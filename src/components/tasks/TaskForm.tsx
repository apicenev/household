import { FlagIcon, TrashIcon } from "@heroicons/react/20/solid";
import { useId, type FormEvent } from "react";
import { MAX_TASK_NOTES, MAX_TASK_TITLE } from "../../domain/tasks";
import { priorityLabels, taskCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import type { Member, TaskPriority } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { DateField } from "../ui/DateField";
import { SegmentedControl } from "../ui/SegmentedControl";
import { TextField } from "../ui/TextField";
import { Textarea } from "../ui/Textarea";
import type { TaskFormValues } from "./taskFormValues";

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
  members: Member[];
  /** Household time zone, for the date field and its quick picks. */
  timeZone: string;
  desktop: boolean;
  /** Validates and saves; also called by Enter in the title (the button may be disabled). */
  onSubmit: () => void;
  /** Phones: «Aufgabe löschen» below the fields (edit only). */
  onDelete?: () => void;
}

/**
 * The fields of «Neue Aufgabe» / «Aufgabe bearbeiten» (`Sheets.dc.html` → «Aufgaben-Sheet
 * oben»): Titel, Notizen, Zuständig, Fällig am, Priorität. Recurrence and rotation follow in
 * Phase 4. The submit buttons live in the sheet footer (`form` attribute).
 */
export function TaskForm({
  formId,
  values,
  onChange,
  titleError,
  autoFocusTitle,
  members,
  timeZone,
  desktop,
  onSubmit,
  onDelete,
}: TaskFormProps) {
  const assigneeLabelId = useId();
  const priorityLabelId = useId();

  const assigneeOptions: Array<{ id: string | null; member?: Member; label: string }> = [
    ...members.map((member) => ({ id: member.uid, member, label: member.displayName })),
    { id: null, label: taskCopy.nobody },
  ];

  return (
    <form
      id={formId}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
      className="flex flex-col gap-5"
    >
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
        data-autofocus={autoFocusTitle ? true : undefined}
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
                onClick={() => onChange({ assigneeId: option.id })}
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
      </div>
      <DateField
        label={taskCopy.dueOn}
        value={values.dueDate}
        onChange={(dueDate) => onChange({ dueDate })}
        quickPicks
        noDatePick
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
      {onDelete && !desktop && (
        <Button variant="danger-ghost" icon={TrashIcon} onClick={onDelete} className="self-start">
          {taskCopy.deleteTask}
        </Button>
      )}
    </form>
  );
}
