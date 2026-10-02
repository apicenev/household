/** Kinds of activity entries (ACT-01). Later phases add task, shopping and event types. */
export type ActivityType = "member_joined";

export type ActivityTargetType = "member";

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
