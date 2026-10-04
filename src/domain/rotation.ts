import type { Member, TaskRotation } from "../types";

/**
 * Assignment rotation of recurring tasks (RTK-05, business rule §8.3, Phase 4 B4). Pure.
 *
 * Stored as `{ memberIds, index }` with `assigneeId == memberIds[index]`. The UI shows and
 * edits an *order*: the same cycle starting with the current assignee («Diesmal»).
 */

type MemberLike = Pick<Member, "uid" | "joinedAt">;

/** The rotation as an order that starts with the current assignee. */
export function rotationOrder(rotation: TaskRotation): string[] {
  const { memberIds, index } = rotation;
  return [...memberIds.slice(index), ...memberIds.slice(0, index)];
}

/** The stored rotation for an order (first = current assignee); `null` below 2 members. */
export function rotationFromOrder(order: readonly string[]): TaskRotation | null {
  return order.length >= 2 ? { memberIds: [...order], index: 0 } : null;
}

/** Same cycle and same current assignee (the stored start doesn't matter). */
export function sameRotation(a: TaskRotation | undefined, b: TaskRotation | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return rotationOrder(a).join("|") === rotationOrder(b).join("|");
}

/** The order rotated so `uid` comes first (picking a member in «Zuständig»). */
export function orderStartingWith(order: readonly string[], uid: string): string[] {
  const index = order.indexOf(uid);
  if (index <= 0) return [...order];
  return [...order.slice(index), ...order.slice(0, index)];
}

/** Moves the entry at `from` to `to` (↑ / ↓ in the picker). */
export function moveInOrder(order: readonly string[], from: number, to: number): string[] {
  if (from === to || to < 0 || to >= order.length || from < 0 || from >= order.length) {
    return [...order];
  }
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function byJoinedAt(a: MemberLike, b: MemberLike): number {
  return a.joinedAt.getTime() - b.joinedAt.getTime();
}

/** `order` without former members, followed by members not in it yet (by `joinedAt`). */
function withCurrentMembers(order: readonly string[], members: readonly MemberLike[]): string[] {
  const memberIds = new Set(members.map((member) => member.uid));
  const kept = order.filter((uid) => memberIds.has(uid));
  const missing = [...members]
    .filter((member) => !kept.includes(member.uid))
    .sort(byJoinedAt)
    .map((member) => member.uid);
  return [...kept, ...missing];
}

/**
 * Starting order of a new rotation (Phase 4 B11): the household default (HH-07) or the
 * members by `joinedAt`, kept up to date, then rotated so the assignee comes first.
 */
export function defaultRotationOrder(
  householdOrder: readonly string[] | undefined,
  members: readonly MemberLike[],
  assigneeId: string | null,
): string[] {
  const order = withCurrentMembers(householdOrder ?? [], members);
  return assigneeId ? orderStartingWith(order, assigneeId) : order;
}

/**
 * The order the picker shows when editing a rotation (Phase 4 B4): saved order without
 * former members, members who joined since appended at the end.
 */
export function rotationForEdit(rotation: TaskRotation, members: readonly MemberLike[]): string[] {
  return withCurrentMembers(rotationOrder(rotation), members);
}

export interface NextAssignee {
  /** `null` when fewer than 2 members are left (the rotation ends). */
  rotation: TaskRotation | null;
  assigneeId: string | null;
}

/**
 * Who's next after a completion (§8.3): the next entry that is still a member. Former
 * members are pruned from the list (§8.4); with fewer than 2 left the rotation ends and the
 * remaining member (if any) keeps the task.
 */
export function nextAssignee(rotation: TaskRotation, memberIds: readonly string[]): NextAssignee {
  const pruned = rotation.memberIds.filter((uid) => memberIds.includes(uid));
  if (pruned.length < 2) return { rotation: null, assigneeId: pruned[0] ?? null };

  const length = rotation.memberIds.length;
  for (let step = 1; step <= length; step++) {
    const uid = rotation.memberIds[(rotation.index + step) % length];
    if (memberIds.includes(uid)) {
      return { rotation: { memberIds: pruned, index: pruned.indexOf(uid) }, assigneeId: uid };
    }
  }
  /* v8 ignore next */
  return { rotation: null, assigneeId: null };
}

/**
 * The rotation without former members, keeping the current assignee (Phase 4 B8, «Nur
 * diese»). If the current assignee left, the next member takes over.
 */
export function pruneRotation(rotation: TaskRotation, memberIds: readonly string[]): NextAssignee {
  const current = rotation.memberIds[rotation.index];
  if (!memberIds.includes(current)) return nextAssignee(rotation, memberIds);
  const pruned = rotation.memberIds.filter((uid) => memberIds.includes(uid));
  if (pruned.length < 2) return { rotation: null, assigneeId: current };
  return { rotation: { memberIds: pruned, index: pruned.indexOf(current) }, assigneeId: current };
}
