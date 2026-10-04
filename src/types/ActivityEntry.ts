/** Kinds of activity entries (ACT-01). */
export type ActivityType =
  | "member_joined"
  | "task_created"
  | "task_completed"
  | "task_assigned"
  | "item_added"
  | "item_purchased"
  | "event_created";

export type ActivityTargetType = "member" | "task" | "item" | "event";

/** households/{hid}/activity/{id}: append-only (ACT-02, ACT-06). */
export interface ActivityEntry {
  id: string;
  actorId: string;
  type: ActivityType;
  targetType: ActivityTargetType;
  targetId: string;
  /** Snapshot of the target's title, so the entry stays readable after a deletion. */
  targetTitle: string;
  details?: Record<string, string | number | boolean | null>;
  createdAt: Date;
}

/** What a caller passes to activityService.record (id and time are set there). */
export type NewActivityInput = Omit<ActivityEntry, "id" | "createdAt">;
