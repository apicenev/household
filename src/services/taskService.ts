import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import {
  buildNextOccurrence,
  isRecurring,
  isUntouched,
  nextOccurrenceId,
  type NextOccurrence,
  type RecurrenceContext,
} from "../domain/tasks";
import { taskConverter } from "../lib/converters/taskConverter";
import { db } from "../lib/firebase";
import type { NewTaskInput, Task, TaskChanges } from "../types";
import { record } from "./activityService";

/**
 * Tasks of a household (Phases 3 and 4). Create, complete and reassignment write their
 * activity entry in the same batch (ACT-01, ACT-05); edits of other fields, reopen and delete
 * don't (Phase 3 B7). Recurring tasks (Phase 4): a completion creates the next occurrence in
 * the same batch (RTK-09); generated occurrences write no entry of their own (B12). Every
 * function returns the commit promise: the UI doesn't wait for it (latency compensation,
 * Phase 3 B8), it only reports a rejection.
 */

function tasksCollection(householdId: string) {
  return collection(db, "households", householdId, "tasks");
}

function taskRef(householdId: string, taskId: string) {
  return doc(db, "households", householdId, "tasks", taskId);
}

/** A fresh random series id (Phase 4 B5): never the task id, never reused. */
function newSeriesId(householdId: string): string {
  return doc(tasksCollection(householdId)).id;
}

/** Firestore fields of a generated occurrence (B7, B8). */
function occurrenceData(next: NextOccurrence, actorId: string) {
  return {
    title: next.title,
    ...(next.notes !== undefined ? { notes: next.notes } : {}),
    assigneeId: next.assigneeId,
    dueDate: next.dueDate,
    priority: next.priority,
    recurrence: next.recurrence,
    ...(next.rotation ? { rotation: next.rotation } : {}),
    seriesId: next.seriesId,
    seriesIndex: next.seriesIndex,
    status: "open",
    createdBy: actorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Realtime task list incl. pending-write state (B14); sorting happens in domain/tasks. */
export function listenToTasks(
  householdId: string,
  onChange: (tasks: Task[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    tasksCollection(householdId).withConverter(taskConverter),
    { includeMetadataChanges: true },
    (snapshot) => onChange(snapshot.docs.map((d) => d.data())),
    onError,
  );
}

/**
 * Creates a task and its «task_created» entry. The id is generated on the client, so the
 * caller can select the new task right away (D19). A task with a rule starts a new series
 * (Phase 4 B5).
 */
export function createTask(
  householdId: string,
  input: NewTaskInput,
  actorId: string,
): { id: string; committed: Promise<void> } {
  const ref = doc(tasksCollection(householdId));
  const batch = writeBatch(db);
  batch.set(ref, {
    title: input.title,
    ...(input.notes ? { notes: input.notes } : {}),
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    priority: input.priority,
    ...(input.recurrence
      ? {
          recurrence: input.recurrence,
          ...(input.rotation ? { rotation: input.rotation } : {}),
          seriesId: newSeriesId(householdId),
          seriesIndex: 1,
        }
      : {}),
    status: "open",
    createdBy: actorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  record(batch, householdId, {
    actorId,
    type: "task_created",
    targetType: "task",
    targetId: ref.id,
    targetTitle: input.title,
  });
  return { id: ref.id, committed: batch.commit() };
}

/**
 * Writes only the changed fields (B8); removed notes become deleteField(). A new assignee
 * adds a «task_assigned» entry with name snapshots («Vorher: Nevio»). Phase 4: `recurrence:
 * null` ends the repeat and removes the rotation with it (B6); a task that gets a rule starts
 * a new series, even if it carries a `seriesId` from an earlier one (B5).
 */
export function updateTask(
  householdId: string,
  task: Task,
  changes: TaskChanges,
  actorId: string,
  nameOf: (uid: string) => string | undefined,
): Promise<void> {
  if (Object.keys(changes).length === 0) return Promise.resolve();

  const { notes, recurrence, rotation, ...fields } = changes;
  const repeat: Record<string, unknown> = {};
  if (recurrence === null) {
    repeat.recurrence = deleteField();
    repeat.rotation = deleteField();
  } else {
    if (recurrence !== undefined) {
      repeat.recurrence = recurrence;
      if (task.recurrence === undefined) {
        repeat.seriesId = newSeriesId(householdId);
        repeat.seriesIndex = 1;
      }
    }
    if (rotation !== undefined) repeat.rotation = rotation ?? deleteField();
  }

  const batch = writeBatch(db);
  batch.update(taskRef(householdId, task.id), {
    ...fields,
    ...(notes !== undefined ? { notes: notes ?? deleteField() } : {}),
    ...repeat,
    updatedAt: serverTimestamp(),
  });

  if (changes.assigneeId !== undefined && changes.assigneeId !== task.assigneeId) {
    const from = task.assigneeId;
    const to = changes.assigneeId;
    record(batch, householdId, {
      actorId,
      type: "task_assigned",
      targetType: "task",
      targetId: task.id,
      targetTitle: changes.title ?? task.title,
      details: {
        fromId: from,
        fromName: from ? (nameOf(from) ?? null) : null,
        toId: to,
        toName: to ? (nameOf(to) ?? null) : null,
      },
    });
  }
  return batch.commit();
}

/**
 * Completes an open task (TSK-04) with its «task_completed» entry. A recurring task goes
 * through `completeRecurringTask` and needs `ctx`.
 */
export function completeTask(
  householdId: string,
  task: Task,
  actorId: string,
  ctx?: RecurrenceContext,
): Promise<void> {
  if (isRecurring(task)) {
    if (!ctx) return Promise.reject(new Error("A recurring task needs a RecurrenceContext"));
    return completeRecurringTask(householdId, task, actorId, ctx);
  }
  const batch = writeBatch(db);
  batch.update(taskRef(householdId, task.id), {
    status: "done",
    completedAt: serverTimestamp(),
    completedBy: actorId,
    updatedAt: serverTimestamp(),
  });
  record(batch, householdId, {
    actorId,
    type: "task_completed",
    targetType: "task",
    targetId: task.id,
    targetTitle: task.title,
  });
  return batch.commit();
}

/**
 * Completes an occurrence and creates the next one in one batch of exactly 3 writes (RTK-04,
 * RTK-09, Phase 4 B7): the occurrence → done (it keeps its rule as history), the next
 * occurrence «{seriesId}-{n+1}» with the rotated assignee, and «task_completed».
 */
export function completeRecurringTask(
  householdId: string,
  task: Task,
  actorId: string,
  ctx: RecurrenceContext,
): Promise<void> {
  const next = buildNextOccurrence(task, ctx, { advanceRotation: true });
  const batch = writeBatch(db);
  batch.update(taskRef(householdId, task.id), {
    status: "done",
    completedAt: serverTimestamp(),
    completedBy: actorId,
    updatedAt: serverTimestamp(),
  });
  batch.set(taskRef(householdId, next.id), occurrenceData(next, actorId));
  record(batch, householdId, {
    actorId,
    type: "task_completed",
    targetType: "task",
    targetId: task.id,
    targetTitle: task.title,
  });
  return batch.commit();
}

/**
 * Reopens a completed task («Rückgängig», TSK-04). No activity entry (Phase 3 B7). For a
 * completed occurrence (RTK-10, Phase 4 B9): if the occurrence generated after it is still
 * untouched, it's deleted in the same batch, so the series is as before; otherwise the task
 * reopens as a normal task without its rule, so there's still one open occurrence (RTK-04).
 * `tasks` is the current task list (to find the generated occurrence).
 */
export function reopenTask(
  householdId: string,
  task: Task,
  tasks: readonly Task[] = [],
): Promise<void> {
  const reopen = {
    status: "open",
    completedAt: deleteField(),
    completedBy: deleteField(),
    updatedAt: serverTimestamp(),
  };
  if (task.recurrence === undefined) return updateDoc(taskRef(householdId, task.id), reopen);

  const nextId = nextOccurrenceId(task);
  const next = tasks.find((candidate) => candidate.id === nextId);
  if (next && isUntouched(next)) {
    const batch = writeBatch(db);
    batch.update(taskRef(householdId, task.id), reopen);
    batch.delete(taskRef(householdId, next.id));
    return batch.commit();
  }
  return updateDoc(taskRef(householdId, task.id), {
    ...reopen,
    recurrence: deleteField(),
    rotation: deleteField(),
  });
}

/**
 * «Nur diese» (RTK-08, Phase 4 B8): deletes the occurrence and creates the next one in one
 * batch; the same person keeps the turn. No activity entry.
 */
export function deleteOccurrence(
  householdId: string,
  task: Task,
  actorId: string,
  ctx: RecurrenceContext,
): Promise<void> {
  const next = buildNextOccurrence(task, ctx, { advanceRotation: false });
  const batch = writeBatch(db);
  batch.delete(taskRef(householdId, task.id));
  batch.set(taskRef(householdId, next.id), occurrenceData(next, actorId));
  return batch.commit();
}

/** Deletes a task (TSK-03). No activity entry (B7). */
export function deleteTask(householdId: string, task: Task): Promise<void> {
  return deleteDoc(taskRef(householdId, task.id));
}

/**
 * «Ganze Serie» (RTK-08): deletes the open occurrence; completed occurrences stay as history.
 * A series has one open occurrence (RTK-04), so this is a single delete.
 */
export function deleteSeries(householdId: string, task: Task): Promise<void> {
  return deleteTask(householdId, task);
}
