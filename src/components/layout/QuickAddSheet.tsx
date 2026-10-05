import {
  CalendarIcon as Calendar16,
  CheckCircleIcon as CheckCircle16,
  ShoppingBagIcon as ShoppingBag16,
} from "@heroicons/react/16/solid";
import { CalendarIcon, CheckCircleIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { areas, terms } from "../../lib/copy";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Sheet } from "../ui/Sheet";
import { useOptionalCalendar } from "../calendar/calendarContext";
import { QuickAddEventForm } from "../calendar/QuickAddEventForm";
import { QuickAddItemForm } from "../shopping/QuickAddItemForm";
import { useOptionalShopping } from "../shopping/shoppingContext";
import { QuickAddTaskForm } from "../tasks/QuickAddTaskForm";
import { useOptionalTasks } from "../tasks/taskContext";
import { ComingSoon } from "./ComingSoon";
import type { QuickAddEntry as Entry } from "./quickAddContext";

const entries: Record<Entry, { label: string; icon: typeof CheckCircleIcon }> = {
  task: { label: terms.task, icon: CheckCircleIcon },
  item: { label: areas.shopping, icon: ShoppingBagIcon },
  event: { label: terms.event, icon: CalendarIcon },
};

/**
 * Schnellerfassung (Sheets.dc.html, from the centre + and the sidebar «Neu»): Aufgabe /
 * Einkauf / Termin («Aufgabe» since Phase 3, «Einkauf» since Phase 5, «Termin» since Phase 6).
 * Without a loaded household (D8) all three show «Bald verfügbar». `initialEntry` opens it on
 * that part (Start's «Artikel hinzufügen», Phase 8 B7); otherwise it keeps the last one.
 */
export function QuickAddSheet({
  open,
  onClose,
  initialEntry,
}: {
  open: boolean;
  onClose: () => void;
  initialEntry?: Entry;
}) {
  const [entry, setEntry] = useState<Entry>("task");
  // Switch to `initialEntry` each time the sheet opens (state adjusted during render).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && initialEntry) setEntry(initialEntry);
  }
  const current = entries[entry];
  const tasks = useOptionalTasks();
  const shopping = useOptionalShopping();
  const calendar = useOptionalCalendar();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={areas.quickAdd}
      hideHeader
      size="sm"
      bodyClassName="gap-4 pt-2 lg:pt-6"
    >
      <SegmentedControl
        aria-label="Art"
        size="lg"
        value={entry}
        onChange={setEntry}
        options={[
          {
            value: "task",
            label: entries.task.label,
            icon: <CheckCircle16 aria-hidden="true" className="size-4" />,
          },
          {
            value: "item",
            label: entries.item.label,
            icon: <ShoppingBag16 aria-hidden="true" className="size-4" />,
          },
          {
            value: "event",
            label: entries.event.label,
            icon: <Calendar16 aria-hidden="true" className="size-4" />,
          },
        ]}
      />
      {entry === "task" && tasks ? (
        <QuickAddTaskForm tasks={tasks} onMoreOptions={onClose} />
      ) : entry === "item" && shopping ? (
        <QuickAddItemForm key="item" shopping={shopping} />
      ) : entry === "event" && calendar ? (
        <QuickAddEventForm key="event" calendar={calendar} onMoreOptions={onClose} />
      ) : (
        <ComingSoon title={current.label} icon={current.icon} as="h2" className="py-8" />
      )}
    </Sheet>
  );
}
