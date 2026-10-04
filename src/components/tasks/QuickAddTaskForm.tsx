import { ArrowPathIcon, CalendarIcon, CheckCircleIcon, FlagIcon } from "@heroicons/react/16/solid";
import { CheckCircleIcon as CheckCircleOutline } from "@heroicons/react/24/outline";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { DEFAULT_PRIORITY, MAX_TASK_TITLE, todayKey } from "../../domain/tasks";
import { priorityLabels, taskCopy, terms } from "../../lib/copy";
import { cx } from "../../lib/cx";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import type { NewTaskInput } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import type { TaskContextValue } from "./taskContext";

interface Chips {
  today: boolean;
  assigneeId: string | null;
  high: boolean;
}

const noChips: Chips = { today: false, assigneeId: null, high: false };

/**
 * Schnellerfassung «Aufgabe» (`Sheets.dc.html`, B13): title, chips «Heute» / members /
 * «Hoch», «Aufgabe hinzufügen». The input keeps focus after adding, so several tasks can be
 * entered in a row; «Mehr Optionen» opens the full «Neue Aufgabe» sheet with the values.
 * The member chips are a single choice (D24). «Wiederholen» opens the full sheet at the
 * repeat section (Phase 4 D31); it's never «on» here.
 */
export function QuickAddTaskForm({
  tasks,
  onMoreOptions,
}: {
  tasks: TaskContextValue;
  /** Closes the Schnellerfassung before the full sheet opens. */
  onMoreOptions: () => void;
}) {
  const { household, members } = useLoadedHousehold();
  const [title, setTitle] = useState("");
  const [chips, setChips] = useState<Chips>(noChips);
  const [added, setAdded] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = title.trim();

  function input(): NewTaskInput {
    return {
      title: trimmed,
      assigneeId: chips.assigneeId,
      dueDate: chips.today ? todayKey(new Date(), household.timeZone) : null,
      priority: chips.high ? "high" : DEFAULT_PRIORITY,
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    tasks.actions.create(input());
    setAdded(taskCopy.addedStatus(trimmed));
    setTitle("");
    setChips(noChips);
    inputRef.current?.focus();
  }

  function moreOptions(focusRepeat = false) {
    const prefill = { ...input(), title };
    onMoreOptions();
    tasks.openNewTask({ prefill, focusRepeat });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex h-14 items-center gap-2.5 rounded-[14px] bg-surface px-3.5 ring-2 ring-brand">
        <CheckCircleOutline aria-hidden="true" className="size-6 shrink-0 text-brand" />
        <input
          ref={inputRef}
          data-autofocus
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setAdded("");
          }}
          maxLength={MAX_TASK_TITLE}
          placeholder={taskCopy.titlePlaceholder}
          aria-label={taskCopy.titlePlaceholder}
          autoComplete="off"
          enterKeyHint="done"
          className="h-full min-w-0 flex-1 bg-transparent text-[18px] text-ink outline-none placeholder:text-ink-subtle"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <QuickChip
          selected={chips.today}
          onClick={() => setChips({ ...chips, today: !chips.today })}
          leading={<CalendarIcon aria-hidden="true" className="size-4" />}
        >
          {terms.today}
        </QuickChip>
        {members.map((member) => (
          <QuickChip
            key={member.uid}
            selected={chips.assigneeId === member.uid}
            onClick={() =>
              setChips({
                ...chips,
                assigneeId: chips.assigneeId === member.uid ? null : member.uid,
              })
            }
            leading={<Avatar initials={member.initials} color={member.avatarColor} size={28} />}
            avatar
          >
            {member.displayName.split(/\s+/)[0]}
          </QuickChip>
        ))}
        <QuickChip
          onClick={() => moreOptions(true)}
          leading={<ArrowPathIcon aria-hidden="true" className="size-4" />}
        >
          {terms.repeat}
        </QuickChip>
        <QuickChip
          selected={chips.high}
          onClick={() => setChips({ ...chips, high: !chips.high })}
          leading={<FlagIcon aria-hidden="true" className="size-4 text-priority-high" />}
        >
          {priorityLabels.high}
        </QuickChip>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => moreOptions()}
          className="flex min-h-11 cursor-pointer items-center text-[15px] font-semibold text-brand-strong hovered:text-brand-hover"
        >
          {taskCopy.moreOptions}
        </button>
        <Button type="submit" size="lg" disabled={!trimmed}>
          {taskCopy.addTask}
        </Button>
      </div>
      <span
        role="status"
        className={cx(
          "flex items-center gap-1.5 text-body-sm font-medium text-success",
          !added && "sr-only",
        )}
      >
        {added && <CheckCircleIcon aria-hidden="true" className="size-4" />}
        {added}
      </span>
    </form>
  );
}

/** A chip of the Schnellerfassung (also used by «Einkauf», Phase 5 D43). */
export function QuickChip({
  selected,
  onClick,
  leading,
  avatar = false,
  children,
}: {
  /** Toggle chips; omitted for an action chip («Wiederholen»), which has no pressed state. */
  selected?: boolean;
  onClick: () => void;
  leading: ReactNode;
  /** The leading element is a 28 px avatar (tighter left padding). */
  avatar?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "flex h-10 cursor-pointer items-center gap-1.5 rounded-pill pr-3 text-body-sm font-semibold transition-colors duration-(--duration-fast)",
        avatar ? "pl-1" : "pl-2.5",
        selected
          ? "bg-brand-soft text-brand-strong inset-ring-[1.5px] inset-ring-brand"
          : "bg-surface text-ink inset-ring inset-ring-line-strong hovered:bg-sunken",
      )}
    >
      {leading}
      {children}
    </button>
  );
}
