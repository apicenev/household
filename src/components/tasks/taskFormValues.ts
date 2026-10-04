import {
  firstDueOnOrAfter,
  pickerFromRule,
  ruleForSave,
  ruleFromPicker,
  type PickerState,
} from "../../domain/recurrence";
import {
  defaultRotationOrder,
  orderStartingWith,
  rotationForEdit,
  rotationFromOrder,
} from "../../domain/rotation";
import { DEFAULT_PRIORITY, normalizeTaskInput } from "../../domain/tasks";
import type {
  Member,
  NewTaskInput,
  Task,
  TaskPriority,
  TaskRotation,
  WeekStart,
} from "../../types";

/** Form values; "" for no date (DateField). */
export interface TaskFormValues {
  title: string;
  notes: string;
  assigneeId: string | null;
  dueDate: string;
  priority: TaskPriority;
  /** «Wiederholen» (Phase 4). */
  repeat: PickerState;
  /** «Abwechseln»: member order, first = current assignee; null when off. */
  rotation: string[] | null;
  /** The user changed the rotation; otherwise a save keeps the stored one (B4). */
  rotationTouched: boolean;
}

export function initialTaskFormValues(
  task: Task | undefined,
  prefill: Partial<NewTaskInput> = {},
  members: readonly Member[] = [],
): TaskFormValues {
  if (task) {
    const repeating = task.recurrence !== undefined;
    return {
      title: task.title,
      notes: task.notes ?? "",
      assigneeId: task.assigneeId,
      dueDate: task.dueDate ?? "",
      priority: task.priority,
      repeat: pickerFromRule(task.recurrence, task.dueDate),
      rotation: repeating && task.rotation ? rotationForEdit(task.rotation, members) : null,
      rotationTouched: false,
    };
  }
  return {
    title: prefill.title ?? "",
    notes: prefill.notes ?? "",
    assigneeId: prefill.assigneeId ?? null,
    dueDate: prefill.dueDate ?? "",
    priority: prefill.priority ?? DEFAULT_PRIORITY,
    repeat: pickerFromRule(prefill.recurrence, prefill.dueDate ?? null),
    rotation: null,
    rotationTouched: false,
  };
}

export const isRepeating = (values: TaskFormValues) => values.repeat.freq !== "none";

/**
 * A new picker state. «Nie» turns the rotation off (D27); a rule picked without a due date
 * fills it with the first matching date from today (D26).
 */
export function withRepeat(
  values: TaskFormValues,
  repeat: PickerState,
  today: string,
  weekStartsOn: WeekStart,
): Partial<TaskFormValues> {
  if (repeat.freq === "none") {
    return {
      repeat,
      rotation: null,
      rotationTouched: values.rotation !== null || values.rotationTouched,
    };
  }
  if (values.dueDate) return { repeat };
  const rule = ruleFromPicker(repeat, today);
  return { repeat, dueDate: rule ? firstDueOnOrAfter(rule, today, weekStartsOn) : today };
}

/**
 * «Zuständig» while rotating (B4): a member rotates the order to them, «Niemand» turns the
 * rotation off.
 */
export function withAssignee(
  values: TaskFormValues,
  assigneeId: string | null,
): Partial<TaskFormValues> {
  if (!values.rotation) return { assigneeId };
  if (assigneeId === null) return { assigneeId, rotation: null, rotationTouched: true };
  return {
    assigneeId,
    rotation: orderStartingWith(values.rotation, assigneeId),
    rotationTouched: true,
  };
}

/** The «Abwechseln» switch: on starts with the household default order (B11). */
export function withRotationSwitch(
  values: TaskFormValues,
  on: boolean,
  householdOrder: readonly string[] | undefined,
  members: readonly Member[],
): Partial<TaskFormValues> {
  if (!on) return { rotation: null, rotationTouched: true };
  const order = defaultRotationOrder(householdOrder, members, values.assigneeId);
  return { rotation: order, assigneeId: order[0] ?? null, rotationTouched: true };
}

/** ↑ / ↓ in the rotation: the first one is the current assignee. */
export function withRotationOrder(order: string[]): Partial<TaskFormValues> {
  return { rotation: order, assigneeId: order[0] ?? null, rotationTouched: true };
}

/** A recurring task keeps a due date (RTK-02): clearing it is ignored while repeating. */
export function withDueDate(values: TaskFormValues, dueDate: string): Partial<TaskFormValues> {
  if (!dueDate && isRepeating(values)) return {};
  return { dueDate };
}

/**
 * The input to save (normalised). The rule comes from the picker (monthly / yearly keep their
 * day unless the due date changed, B6); an untouched rotation stays as stored (B4).
 */
export function taskInputFromValues(
  values: TaskFormValues,
  title: string,
  original?: Task,
): NewTaskInput {
  const dueDate = values.dueDate || null;
  const rule =
    dueDate && isRepeating(values)
      ? ruleForSave(
          values.repeat,
          dueDate,
          original ? { rule: original.recurrence, dueDate: original.dueDate } : undefined,
        )
      : null;
  let rotation: TaskRotation | undefined;
  if (rule && values.rotation) {
    rotation =
      !values.rotationTouched && original?.rotation
        ? original.rotation
        : (rotationFromOrder(values.rotation) ?? undefined);
  }
  return normalizeTaskInput({
    title,
    notes: values.notes,
    assigneeId: values.assigneeId,
    dueDate,
    priority: values.priority,
    ...(rule ? { recurrence: rule } : {}),
    ...(rotation ? { rotation } : {}),
  });
}
