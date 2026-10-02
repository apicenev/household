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
import { taskConverter } from "../lib/converters/taskConverter";
import { db } from "../lib/firebase";
import type { NewTaskInput, Task, TaskChanges } from "../types";
import { record } from "./activityService";

/**
 * Tasks of a household (Phase 3). Create, complete and reassignment write their activity
 * entry in the same batch (ACT-01, ACT-05); edits of other fields, reopen and delete don't
 * (B7). Every function returns the commit promise: the UI doesn't wait for it (latency
 * compensation, B8), it only reports a rejection.
 */

function tasksCollection(householdId: string) {
  return collection(db, "households", householdId, "tasks");
}

function taskRef(householdId: string, taskId: string) {
  return doc(db, "households", householdId, "tasks", taskId);
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
 * caller can select the new task right away (D19).
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
 * adds a «task_assigned» entry with name snapshots («Vorher: Nevio»).
 */
export function updateTask(
  householdId: string,
  task: Task,
  changes: TaskChanges,
  actorId: string,
  nameOf: (uid: string) => string | undefined,
): Promise<void> {
  if (Object.keys(changes).length === 0) return Promise.resolve();

  const { notes, ...fields } = changes;
  const batch = writeBatch(db);
  batch.update(taskRef(householdId, task.id), {
    ...fields,
    ...(notes !== undefined ? { notes: notes ?? deleteField() } : {}),
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

/** Completes an open task (TSK-04) with its «task_completed» entry. */
export function completeTask(householdId: string, task: Task, actorId: string): Promise<void> {
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

/** Reopens a completed task («Rückgängig», TSK-04). No activity entry (B7). */
export function reopenTask(householdId: string, task: Task): Promise<void> {
  return updateDoc(taskRef(householdId, task.id), {
    status: "open",
    completedAt: deleteField(),
    completedBy: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/** Deletes a task (TSK-03). No activity entry (B7). */
export function deleteTask(householdId: string, task: Task): Promise<void> {
  return deleteDoc(taskRef(householdId, task.id));
}
