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
import { QuickAddItemForm } from "../shopping/QuickAddItemForm";
import { useOptionalShopping } from "../shopping/shoppingContext";
import { QuickAddTaskForm } from "../tasks/QuickAddTaskForm";
import { useOptionalTasks } from "../tasks/taskContext";
import { ComingSoon } from "./ComingSoon";

type Entry = "task" | "item" | "event";

const entries: Record<Entry, { label: string; icon: typeof CheckCircleIcon }> = {
  task: { label: terms.task, icon: CheckCircleIcon },
  item: { label: areas.shopping, icon: ShoppingBagIcon },
  event: { label: terms.event, icon: CalendarIcon },
};

/**
 * Schnellerfassung (Sheets.dc.html, from the centre + and the sidebar «Neu»): Aufgabe /
 * Einkauf / Termin. «Aufgabe» since Phase 3, «Einkauf» since Phase 5; Termin shows «Bald
 * verfügbar» until Phase 6. Without a loaded household (D8) all three show «Bald verfügbar».
 */
export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entry, setEntry] = useState<Entry>("task");
  const current = entries[entry];
  const tasks = useOptionalTasks();
  const shopping = useOptionalShopping();

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
      ) : (
        <ComingSoon title={current.label} icon={current.icon} as="h2" className="py-8" />
      )}
    </Sheet>
  );
}
