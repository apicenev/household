import type { AvatarColor, Household, Task, TaskRotation } from "../types";

/**
 * Initials for the avatar: first letters of the first and last word, or the first two letters
 * of a single word. «Nevio Apicella» → «NA», «Anna» → «AN».
 */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1
      ? Array.from(words[0]).slice(0, 2)
      : [Array.from(words[0])[0], Array.from(words[words.length - 1])[0]];
  return letters.join("").toLocaleUpperCase("de-CH");
}

/** Stable default avatar colour (1–8) derived from the uid; members can change it later. */
export function avatarColorFor(uid: string): AvatarColor {
  let hash = 0;
  for (const char of uid) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return ((hash % 8) + 1) as AvatarColor;
}

/** Trimmed display name, or why it isn't valid: same rules as household names (1–50). */
export { validateHouseholdName as validateDisplayName } from "./household";

/** Why «Haushalt verlassen» is off (Phase 9 B1, D84, D96), or `ok`. */
export type LeaveState = "ok" | "owner" | "alone" | "demo";

export function canLeave(household: Household, uid: string): LeaveState {
  if (household.demo) return "demo";
  if (household.memberIds.length <= 1) return "alone";
  if (household.ownerId === uid) return "owner";
  return "ok";
}

/** A task change of the cleanup: the new assignee, and the new rotation or `null` to drop it. */
export interface TaskCleanup {
  taskId: string;
  assigneeId: string | null;
  /** Omitted when the rotation stays as it is. */
  rotation?: TaskRotation | null;
}

/** Rotation without `uid` (Phase 9 B3); `null` when fewer than two people remain. */
function rotationWithout(
  rotation: TaskRotation,
  uid: string,
): { rotation: TaskRotation | null; assigneeId: string | null } | null {
  const position = rotation.memberIds.indexOf(uid);
  if (position === -1) return null;
  const memberIds = rotation.memberIds.filter((id) => id !== uid);
  if (memberIds.length < 2) return { rotation: null, assigneeId: null };
  // Keep `index` pointing at the same person; if it was the leaver's turn, the next one is up.
  const index = position < rotation.index ? rotation.index - 1 : rotation.index % memberIds.length;
  return { rotation: { memberIds, index }, assigneeId: memberIds[index] };
}

/**
 * The task changes when `uid` leaves or is removed (Phase 9 B3, business rule §8.4): open
 * tasks of theirs become unassigned; rotations lose them and keep `assigneeId ==
 * memberIds[index]` (the next person if it was their turn); a rotation of fewer than two is
 * dropped. Done tasks stay as history. Events aren't touched (B19).
 */
export function memberCleanup(tasks: readonly Task[], uid: string): TaskCleanup[] {
  const changes: TaskCleanup[] = [];
  for (const task of tasks) {
    if (task.status !== "open") continue;
    const rotated = task.rotation ? rotationWithout(task.rotation, uid) : null;
    if (rotated) {
      const assigneeId =
        rotated.rotation === null
          ? task.assigneeId === uid
            ? null
            : task.assigneeId
          : rotated.assigneeId;
      changes.push({ taskId: task.id, assigneeId, rotation: rotated.rotation });
    } else if (task.assigneeId === uid) {
      changes.push({ taskId: task.id, assigneeId: null });
    }
  }
  return changes;
}

/** The default rotation order without `uid`, or `undefined` if it doesn't hold them. */
export function rotationOrderWithout(household: Household, uid: string): string[] | undefined {
  if (!household.rotationOrder?.includes(uid)) return undefined;
  return household.rotationOrder.filter((id) => id !== uid);
}
