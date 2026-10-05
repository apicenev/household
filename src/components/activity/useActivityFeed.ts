import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACTIVITY_PAGE_SIZE,
  filterTargetType,
  mergeFeed,
  type ActivityFilter,
} from "../../domain/activity";
import { listenToActivity, loadOlderActivity, type FeedItem } from "../../services/activityService";

export interface ActivityFeed {
  /** Newest first: the live page merged with older pages and entries pushed off it (B2). */
  items: FeedItem[];
  /** True until the first live snapshot has arrived. */
  loading: boolean;
  /** Live listener error (D81). */
  error: Error | null;
  retry: () => void;
  /** «Mehr laden» is offered: 50 or more entries and the last older page was full. */
  hasMore: boolean;
  loadingMore: boolean;
  /** The last «Mehr laden» failed; calling `loadMore` again retries. */
  loadMoreError: Error | null;
  loadMore: () => void;
}

/**
 * The activity feed of /activity (ACT-03, ACT-04, ACT-08; Phase 8 B1–B3): a live listener on
 * the latest 50 entries (of one target type), plus older pages read on «Mehr laden». Every
 * snapshot is merged into what was there, so entries pushed off the live page stay; the next
 * page starts after the oldest merged entry. A new filter starts over.
 */
export function useActivityFeed(householdId: string, filter: ActivityFilter): ActivityFeed {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null);
  // Results of a «Mehr laden» started for an earlier filter (or attempt) are dropped.
  const generation = useRef(0);
  const targetType = filterTargetType(filter);

  // A new filter or retry starts over (state adjusted during render, before the listener).
  const key = `${householdId}|${filter}|${attempt}`;
  const [currentKey, setCurrentKey] = useState(key);
  if (key !== currentKey) {
    setCurrentKey(key);
    setItems([]);
    setLoading(true);
    setError(null);
    setExhausted(false);
    setLoadingMore(false);
    setLoadMoreError(null);
  }

  useEffect(() => {
    generation.current += 1;
    return listenToActivity(
      householdId,
      targetType,
      (live) => {
        setItems((current) => mergeFeed(live, current));
        setLoading(false);
      },
      (listenError) => setError(listenError),
    );
  }, [householdId, targetType, attempt]);

  const loadMore = useCallback(() => {
    const oldest = items[items.length - 1];
    if (!oldest || loadingMore) return;
    const started = generation.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    loadOlderActivity(householdId, targetType, oldest.cursor).then(
      (page) => {
        if (generation.current !== started) return;
        setItems((current) => mergeFeed(page, current));
        if (page.length < ACTIVITY_PAGE_SIZE) setExhausted(true);
        setLoadingMore(false);
      },
      (loadError: unknown) => {
        if (generation.current !== started) return;
        setLoadMoreError(loadError instanceof Error ? loadError : new Error(String(loadError)));
        setLoadingMore(false);
      },
    );
  }, [householdId, targetType, items, loadingMore]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    items,
    loading: loading && error === null,
    error,
    retry,
    hasMore: !exhausted && items.length >= ACTIVITY_PAGE_SIZE,
    loadingMore,
    loadMoreError,
    loadMore,
  };
}
