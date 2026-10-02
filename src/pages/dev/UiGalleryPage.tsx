import {
  CalendarIcon as Calendar16,
  CheckCircleIcon as CheckCircle16,
  ChevronRightIcon,
  ExclamationCircleIcon as ExclamationCircle16,
  FlagIcon,
  LockClosedIcon,
  PlusIcon as Plus16,
  ShoppingBagIcon as ShoppingBag16,
} from "@heroicons/react/16/solid";
import {
  ExclamationCircleIcon,
  PlusIcon,
  TrashIcon as TrashIcon20,
} from "@heroicons/react/20/solid";
import {
  ArrowRightStartOnRectangleIcon,
  CalendarIcon as CalendarOutline,
  CheckBadgeIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  ForwardIcon,
  PencilIcon,
  TrashIcon,
  UserCircleIcon,
  UserIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ArrowUturnLeftIcon } from "@heroicons/react/16/solid";
import { useState, type ReactNode } from "react";
import { Avatar, AvatarGroup, AvatarInvite, type AvatarColor } from "../../components/ui/Avatar";
import { Badge, CountBadge } from "../../components/ui/Badge";
import { Button, type ButtonVariant } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Menu } from "../../components/ui/Menu";
import { Sheet } from "../../components/ui/Sheet";
import { useToast } from "../../components/ui/toastContext";
import { type EventCategory, type ShopCategory } from "../../components/ui/categories";
import { CategoryLabel } from "../../components/ui/CategoryLabel";
import { Checkbox } from "../../components/ui/Checkbox";
import { DateField } from "../../components/ui/DateField";
import { EmptyState } from "../../components/ui/EmptyState";
import { FilterChip, FilterChipGroup, RemovableChip } from "../../components/ui/FilterChip";
import { IconButton } from "../../components/ui/IconButton";
import { InlineAlert } from "../../components/ui/InlineAlert";
import { ListRow } from "../../components/ui/ListRow";
import { PriorityMarker, type Priority } from "../../components/ui/PriorityMarker";
import { RecurrenceBadge } from "../../components/ui/RecurrenceBadge";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Select } from "../../components/ui/Select";
import { SkeletonList } from "../../components/ui/Skeleton";
import { TextField } from "../../components/ui/TextField";
import { Textarea } from "../../components/ui/Textarea";
import { TimeField } from "../../components/ui/TimeField";
import { Toggle } from "../../components/ui/Toggle";
import { cx } from "../../lib/cx";

/*
 * Development-only gallery (/dev/ui): every primitive in every state, in the order of
 * docs/design/Components.dc.html, for side-by-side comparison at 390 px and 1440 px.
 * Hover / pressed / focus are frozen with data-state, like on the sheet.
 */

const NA = { initials: "NA", color: 6 as AvatarColor, name: "Nevio" };
const AN = { initials: "AN", color: 1 as AvatarColor, name: "Anna" };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <h2 className="font-display text-[30px] leading-9 font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "text-[11px] font-semibold tracking-[0.06em] text-ink-subtle uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <Card className={cx("p-6", className)}>{children}</Card>;
}

const buttonRows: Array<{ variant: ButtonVariant; name: string; label: string; loading: string }> =
  [
    { variant: "primary", name: "Primär", label: "Aufgabe hinzufügen", loading: "Speichert…" },
    { variant: "secondary", name: "Sekundär", label: "Abbrechen", loading: "Tritt bei…" },
    { variant: "ghost", name: "Ghost", label: "Alle anzeigen", loading: "Lädt" },
    { variant: "danger", name: "Gefahr", label: "Löschen", loading: "Löscht…" },
    { variant: "danger-ghost", name: "Gefahr-Einstieg", label: "Aufgabe löschen", loading: "Lädt" },
  ];

function ButtonsSection() {
  return (
    <Section id="buttons" title="Button">
      <Panel className="overflow-x-auto">
        <div className="grid min-w-225 grid-cols-[110px_repeat(6,max-content)] items-center gap-x-5 gap-y-4">
          <span />
          {["Standard", "Hover", "Gedrückt", "Fokus", "Deaktiviert", "Lädt"].map((state) => (
            <Label key={state}>{state}</Label>
          ))}
          {buttonRows.map((row) => (
            <ButtonRow key={row.variant} {...row} />
          ))}
        </div>
        <div className="my-6 h-px min-w-225 bg-line" />
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-2">
            <Label>md · 48</Label>
            <Button icon={PlusIcon}>Neue Aufgabe</Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label>sm · 36 (44 Trefferfläche)</Label>
            <div className="flex gap-2">
              <Button size="sm" icon={Plus16}>
                Hinzufügen
              </Button>
              <Button size="sm" variant="secondary">
                Bearbeiten
              </Button>
              <Button size="sm" variant="ghost" trailingIcon={ChevronRightIcon}>
                Alle anzeigen
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>compact · 44</Label>
            <Button size="compact" variant="secondary" icon={PlusIcon}>
              Aufgabe hinzufügen
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Nur Icon · 44</Label>
            <div className="flex gap-2">
              <IconButton aria-label="Mehr" icon={EllipsisHorizontalIcon} />
              <IconButton aria-label="Mehr" icon={EllipsisHorizontalIcon} variant="sunken" />
              <IconButton aria-label="Bearbeiten" icon={PencilIcon} variant="outline" />
              <IconButton
                aria-label="Schliessen"
                icon={XMarkIcon}
                variant="sunken"
                className="text-ink-muted"
                data-state="focus"
              />
              <IconButton aria-label="Löschen" icon={TrashIcon} variant="danger" />
            </div>
          </div>
        </div>
      </Panel>
    </Section>
  );
}

function ButtonRow({
  variant,
  name,
  label,
  loading,
}: {
  variant: ButtonVariant;
  name: string;
  label: string;
  loading: string;
}) {
  return (
    <>
      <span className="text-body-sm font-semibold">{name}</span>
      <Button variant={variant}>{label}</Button>
      <Button variant={variant} data-state="hover">
        {label}
      </Button>
      <Button variant={variant} data-state="hover pressed">
        {label}
      </Button>
      <Button variant={variant} data-state="focus">
        {label}
      </Button>
      <Button variant={variant} disabled>
        {label}
      </Button>
      <Button variant={variant} loading loadingLabel={loading}>
        {label}
      </Button>
    </>
  );
}

function FieldsSection() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState(
    "Ablage abwischen, Geschirrspüler ausräumen, Kompost runterbringen.",
  );
  const [assignee, setAssignee] = useState("anna");
  const [due, setDue] = useState("2026-10-03");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const person = assignee === "anna" ? AN : NA;

  return (
    <Section id="fields" title="Textfeld · Textbereich · Auswahl · Datum · Zeit">
      <Panel className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-6 gap-y-7">
        <div className="flex flex-col gap-1.5">
          <Label>Standard (live)</Label>
          <TextField
            label="Titel"
            placeholder="z. B. Küche putzen"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Hover</Label>
          <TextField label="Titel" placeholder="z. B. Küche putzen" data-state="hover" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Fokus</Label>
          <TextField label="Titel" defaultValue="Küche putzen" data-state="focus" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Ausgefüllt + Hilfetext</Label>
          <TextField
            label="E-Mail"
            type="email"
            defaultValue="nevio@example.com"
            helper="Wir nutzen sie nur zum Anmelden."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Deaktiviert</Label>
          <TextField
            label="Haushaltscode"
            defaultValue="MST-4821"
            disabled
            leading={<LockClosedIcon className="size-4" />}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Fehler</Label>
          <TextField
            label="Titel"
            placeholder="z. B. Küche putzen"
            error="Gib der Aufgabe einen Namen."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Textbereich</Label>
          <Textarea
            label="Notizen"
            optional
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Textbereich · Fehler</Label>
          <Textarea
            label="Beschreibung"
            defaultValue="Wein mitbringen und …"
            error="Maximal 500 Zeichen."
            showCount={false}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Auswahl</Label>
          <Select
            label="Zuständig"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            options={[
              { value: "anna", label: "Anna" },
              { value: "nevio", label: "Nevio" },
            ]}
            leading={<Avatar initials={person.initials} color={person.color} size={28} />}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Auswahl · deaktiviert</Label>
          <Select
            label="Zeitzone"
            disabled
            options={[{ value: "Europe/Zurich", label: "Europe/Zurich" }]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Datumsfeld</Label>
          <DateField
            label="Fällig am"
            value={due}
            onChange={setDue}
            quickPicks
            today={new Date("2026-09-30T10:00:00Z")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Zeitfeld</Label>
          <div className="flex items-end gap-2">
            <TimeField
              label="Zeit"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="flex-1"
            />
            <span className="flex h-12 items-center text-ink-muted" aria-hidden="true">
              –
            </span>
            <TimeField
              label={<span className="sr-only">Bis</span>}
              showIcon={false}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="flex-1"
            />
          </div>
          <span className="text-[13px] text-ink-muted">2 Stunden</span>
        </div>
      </Panel>
    </Section>
  );
}

function ControlsSection() {
  const [demo, setDemo] = useState({ a: false, b: true, c: false });
  const [toggles, setToggles] = useState({ allday: false, notify: true });
  const [seg, setSeg] = useState<"task" | "item" | "event">("task");
  const [view, setView] = useState<"month" | "upcoming">("month");
  const [priority, setPriority] = useState<"none" | Priority>("high");

  const checkboxStates: Array<{ label: string; node: ReactNode }> = [
    {
      label: "Standard",
      node: <Checkbox aria-label="Standard" checked={false} onChange={() => {}} />,
    },
    {
      label: "Hover",
      node: <Checkbox aria-label="Hover" checked={false} onChange={() => {}} data-state="hover" />,
    },
    {
      label: "Gedrückt",
      node: (
        <Checkbox aria-label="Gedrückt" checked={false} onChange={() => {}} data-state="pressed" />
      ),
    },
    {
      label: "Fokus",
      node: <Checkbox aria-label="Fokus" checked={false} onChange={() => {}} data-state="focus" />,
    },
    { label: "Erledigt", node: <Checkbox aria-label="Erledigt" checked onChange={() => {}} /> },
    {
      label: "Überfällig",
      node: <Checkbox aria-label="Überfällig" checked={false} overdue onChange={() => {}} />,
    },
    {
      label: "Deaktiviert",
      node: <Checkbox aria-label="Deaktiviert" checked={false} disabled onChange={() => {}} />,
    },
    {
      label: "Sync läuft",
      node: <Checkbox aria-label="Sync läuft" checked={false} syncing onChange={() => {}} />,
    },
  ];

  return (
    <Section id="controls" title="Checkbox · Schalter · Segmentierte Auswahl">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
        <Panel className="flex flex-col gap-5">
          <span className="text-body-sm text-ink-muted">
            Rund, 26 px sichtbar in einer 44-px-Trefferfläche. Tippe irgendwo auf den Ring.
          </span>
          <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-4 text-center">
            {checkboxStates.map((state) => (
              <div key={state.label} className="flex flex-col items-center gap-1.5">
                {state.node}
                <Label className="tracking-[0.04em]">{state.label}</Label>
              </div>
            ))}
          </div>
          <div className="flex flex-col rounded-control bg-sunken py-1">
            {(
              [
                ["a", "Altpapier rausbringen"],
                ["b", "Pflanzen giessen"],
                ["c", "Küche putzen"],
              ] as const
            ).map(([key, title]) => (
              <div key={key} className="flex min-h-13 items-center gap-2 pr-3 pl-1">
                <Checkbox
                  aria-label={title}
                  checked={demo[key]}
                  onChange={(checked) => setDemo((d) => ({ ...d, [key]: checked }))}
                />
                <span
                  className={cx(
                    "text-body font-medium transition-colors duration-(--duration-base)",
                    demo[key] ? "text-ink-subtle line-through" : "text-ink",
                  )}
                >
                  {title}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-5">
          <div className="grid grid-cols-5 justify-items-center gap-2">
            {[
              {
                label: "Aus",
                node: <Toggle aria-label="Aus" checked={false} onChange={() => {}} />,
              },
              { label: "An", node: <Toggle aria-label="An" checked onChange={() => {}} /> },
              {
                label: "Fokus",
                node: <Toggle aria-label="Fokus" checked onChange={() => {}} data-state="focus" />,
              },
              {
                label: "Deaktiviert",
                node: (
                  <Toggle aria-label="Deaktiviert" checked={false} disabled onChange={() => {}} />
                ),
              },
              {
                label: "Deakt. an",
                node: <Toggle aria-label="Deaktiviert an" checked disabled onChange={() => {}} />,
              },
            ].map((state) => (
              <div key={state.label} className="flex flex-col items-center gap-0.5">
                {state.node}
                <Label className="tracking-[0.04em]">{state.label}</Label>
              </div>
            ))}
          </div>
          <div className="flex flex-col border-t border-line">
            <Toggle
              label="Ganztägig"
              hint="Beginn- und Endzeit ausblenden"
              checked={toggles.allday}
              onChange={(allday) => setToggles((t) => ({ ...t, allday }))}
            />
            <Toggle
              label="Erinnern"
              hint="30 Minuten vorher"
              checked={toggles.notify}
              onChange={(notify) => setToggles((t) => ({ ...t, notify }))}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <Label>Segmentiert (live)</Label>
            <SegmentedControl
              aria-label="Art"
              value={seg}
              onChange={setSeg}
              options={[
                {
                  value: "task",
                  label: "Aufgabe",
                  icon: <CheckCircle16 aria-hidden="true" className="size-4" />,
                },
                {
                  value: "item",
                  label: "Artikel",
                  icon: <ShoppingBag16 aria-hidden="true" className="size-4" />,
                },
                {
                  value: "event",
                  label: "Termin",
                  icon: <Calendar16 aria-hidden="true" className="size-4" />,
                },
              ]}
            />
            <SegmentedControl
              aria-label="Ansicht"
              size="sm"
              value={view}
              onChange={setView}
              className="max-w-60"
              options={[
                { value: "month", label: "Monat" },
                { value: "upcoming", label: "Demnächst" },
              ]}
            />
          </div>
        </Panel>
      </div>
      <Panel className="flex flex-wrap items-center gap-5">
        <Label>Priorität (live)</Label>
        <SegmentedControl
          aria-label="Priorität"
          size="sm"
          fit
          value={priority}
          onChange={setPriority}
          options={[
            { value: "none", label: "Keine" },
            {
              value: "low",
              label: "Niedrig",
              icon: <FlagIcon aria-hidden="true" className="size-4 text-priority-low" />,
              selectedClassName: "text-priority-low",
            },
            {
              value: "medium",
              label: "Mittel",
              icon: <FlagIcon aria-hidden="true" className="size-4 text-priority-medium" />,
              selectedClassName: "text-priority-medium",
            },
            {
              value: "high",
              label: "Hoch",
              icon: <FlagIcon aria-hidden="true" className="size-4" />,
              selectedClassName: "text-priority-high",
            },
          ]}
        />
      </Panel>
    </Section>
  );
}

function ChipsSection() {
  const [chips, setChips] = useState({
    mine: true,
    overdue: false,
    today: false,
    week: false,
    high: false,
  });
  const chipLabels: Record<keyof typeof chips, string> = {
    mine: "Meine",
    overdue: "Überfällig",
    today: "Heute",
    week: "Diese Woche",
    high: "Priorität Hoch",
  };
  const events: EventCategory[] = ["social", "appointment", "travel", "home", "reminder", "other"];
  const shops: ShopCategory[] = ["groceries", "household", "pharmacy", "other"];

  return (
    <Section
      id="chips"
      title="Filter-Chips · Avatar · Badge · Priorität · Kategorie · Wiederholung"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
        <Panel className="flex flex-col gap-4.5">
          <Label>Zustände</Label>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip>Standard</FilterChip>
            <FilterChip data-state="hover">Hover</FilterChip>
            <FilterChip selected>Ausgewählt</FilterChip>
            <FilterChip data-state="focus">Fokus</FilterChip>
            <FilterChip disabled>Deaktiviert</FilterChip>
            <RemovableChip
              label="Anna"
              onRemove={() => {}}
              leading={<Avatar initials="AN" color={1} size={28} />}
            />
            <FilterChip menu selected>
              Fällig: Diese Woche
            </FilterChip>
          </div>
          <Label>Live-Filterzeile</Label>
          <FilterChipGroup aria-label="Filter">
            {(Object.keys(chips) as Array<keyof typeof chips>).map((key) => (
              <FilterChip
                key={key}
                selected={chips[key]}
                onClick={() => setChips((c) => ({ ...c, [key]: !c[key] }))}
              >
                {chipLabels[key]}
              </FilterChip>
            ))}
          </FilterChipGroup>
          <span className="text-[13px] leading-[19px] text-ink-muted">
            Chips sind 36 px hoch mit 8 px Abstand; die Zeile ergänzt 4 px vertikal, damit jede
            Trefferfläche 44 px erreicht.
          </span>
        </Panel>

        <Panel className="flex flex-col gap-4.5">
          <Label>Avatar · sm 24 / md 32 / lg 48 / xl 72</Label>
          <div className="flex flex-wrap items-end gap-3.5">
            <Avatar initials="NA" color={6} size={24} />
            <Avatar initials="NA" color={6} size={32} />
            <Avatar initials="NA" color={6} size={48} />
            <Avatar initials="AN" color={1} size={72} />
            <AvatarInvite />
          </div>
          <Label>Gestapelte Gruppe</Label>
          <div className="flex flex-wrap items-center gap-7">
            <AvatarGroup
              label="Alle"
              members={[
                { id: "na", ...NA },
                { id: "an", ...AN },
              ]}
            />
            <AvatarGroup
              members={[
                { id: "na", ...NA },
                { id: "an", ...AN },
                { id: "lm", name: "Lea", initials: "LM", color: 3 },
                { id: "jo", name: "Jonas", initials: "JO", color: 4 },
                { id: "sk", name: "Sara", initials: "SK", color: 5 },
              ]}
            />
          </div>
          <Label>Badge / Tag</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Besitzer</Badge>
            <Badge variant="brand">Du</Badge>
            <Badge variant="success">Erledigt</Badge>
            <Badge variant="warning">Offline</Badge>
            <Badge variant="danger">Überfällig · 1 Tag</Badge>
            <CountBadge count={5} />
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4.5">
          <Label>Prioritätsmarker · in Zeilen / im Detail</Label>
          <div className="flex flex-wrap items-center gap-5">
            <PriorityMarker priority="high" />
            <PriorityMarker priority="medium" />
            <PriorityMarker priority="low" />
            <span className="h-6 w-px bg-line" />
            <PriorityMarker priority="high" size="row" />
            <PriorityMarker priority="medium" size="row" />
            <PriorityMarker priority="low" size="row" />
          </div>
          <Label>Kategorie-Punkt + Label</Label>
          <div className="flex flex-wrap gap-1.5">
            {events.map((category) => (
              <CategoryLabel key={category} kind="event" category={category} />
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {shops.map((category) => (
              <CategoryLabel key={category} kind="shop" category={category} variant="dot" />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-2.5">
            {events.map((category) => (
              <CategoryLabel key={category} kind="event" category={category} variant="legend" />
            ))}
          </div>
          <Label>Wiederholen & Abwechseln</Label>
          <div className="flex flex-wrap items-center gap-4">
            <RecurrenceBadge rule="Alle 2 Wochen" />
            <RecurrenceBadge rule="Alle 4 Tage" />
            <RecurrenceBadge rotation={["Nevio", "Anna"]} />
            <RecurrenceBadge variant="pill" rule="Jeden Samstag" rotation={["Nevio", "Anna"]} />
          </div>
        </Panel>
      </div>
    </Section>
  );
}

function RowsSection() {
  const rows: Array<{
    state: string;
    title: string;
    who: typeof NA;
    meta: ReactNode;
    props?: Record<string, unknown>;
    checkbox?: Record<string, unknown>;
    trailing?: ReactNode;
    done?: boolean;
    disabled?: boolean;
  }> = [
    { state: "Standard", title: "Altpapier rausbringen", who: NA, meta: "Heute" },
    {
      state: "Hover",
      title: "Küche putzen",
      who: AN,
      meta: "Heute",
      props: { "data-state": "hover" },
      trailing: <PriorityMarker priority="high" size="row" />,
    },
    {
      state: "Gedrückt",
      title: "Bad putzen",
      who: NA,
      meta: (
        <>
          <span className="font-medium">Sa., 3. Okt.</span>·
          <RecurrenceBadge rule="Wöchentlich · Nevio → Anna" />
        </>
      ),
      props: { "data-state": "pressed" },
      checkbox: { "data-state": "pressed" },
    },
    {
      state: "Fokus",
      title: "Bettwäsche wechseln",
      who: AN,
      meta: (
        <>
          <span className="font-medium">So., 4. Okt.</span>·
          <RecurrenceBadge rule="Alle 2 Wochen" />
        </>
      ),
      props: { className: "rounded-control outline-2 -outline-offset-2 outline-focus" },
    },
    {
      state: "Überfällig",
      title: "Pflanzen giessen",
      who: NA,
      meta: (
        <>
          <span className="inline-flex items-center gap-1 font-semibold text-danger">
            <ExclamationCircle16 aria-hidden="true" className="size-3.5" />
            Gestern
          </span>
          ·
          <RecurrenceBadge rule="Alle 4 Tage" />
        </>
      ),
      checkbox: { overdue: true },
    },
    {
      state: "Erledigt",
      title: "Bad putzen",
      who: AN,
      meta: "Anna · Sa., 26. Sept.",
      done: true,
    },
    {
      state: "Deaktiviert",
      title: "Vermieter wegen Heizung anrufen",
      who: NA,
      meta: "Ohne Datum",
      disabled: true,
    },
  ];

  return (
    <Section id="rows" title="Karte · Listenzeile · Abschnittstitel">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-6">
        <div className="flex flex-col gap-2">
          <SectionHeader title="Heute" count="7 offen" onShowAll={() => {}} as="h3" />
          <div className="relative lg:mr-27.5">
            <Card>
              {rows.map((row, index) => (
                <div key={row.state} className="relative">
                  <ListRow
                    size="lg"
                    interactive
                    title={row.title}
                    meta={row.meta}
                    done={row.done}
                    disabled={row.disabled}
                    divider={index < rows.length - 1}
                    leading={
                      <Checkbox
                        aria-label={row.title}
                        checked={Boolean(row.done)}
                        disabled={row.disabled}
                        onChange={() => {}}
                        {...row.checkbox}
                      />
                    }
                    trailing={
                      <>
                        {row.trailing}
                        <Avatar initials={row.who.initials} color={row.who.color} size={28} />
                      </>
                    }
                    {...row.props}
                  />
                  <Label className="absolute top-1/2 -right-27.5 hidden w-24 -translate-y-1/2 lg:block">
                    {row.state}
                  </Label>
                </div>
              ))}
            </Card>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <SectionHeader title="Überfällig" icon={ExclamationCircleIcon} tone="danger" as="h3" />
          <Card padding="lg" className="flex flex-col gap-3">
            <Label>Aufbau einer Karte</Label>
            <span className="text-body-sm leading-[21px] text-ink-muted">
              Fläche, 18 px Radius, Kartenschatten. Zeilen laufen randlos mit 4 px Einzug links,
              damit die 44-px-Checkbox mit dem Abschnittstitel fluchtet. Trennlinien beginnen beim
              Text, nicht am Kartenrand.
            </span>
            <div className="flex flex-wrap gap-2">
              <Badge>padding 16 / 20</Badge>
              <Badge>Zeile ≥ 56</Badge>
              <Badge>Abstand 24 zwischen Karten</Badge>
            </div>
          </Card>
        </div>
      </div>
    </Section>
  );
}

function OverlaysSection() {
  const toast = useToast();
  // ?open=sheet|wide|confirm|typed opens an overlay on load (for screenshots and comparison).
  const initial = new URLSearchParams(window.location.search).get("open");
  const [sheet, setSheet] = useState(initial === "sheet");
  const [wide, setWide] = useState(initial === "wide");
  const [confirm, setConfirm] = useState(initial === "confirm");
  const [typed, setTyped] = useState(initial === "typed");
  const [title, setTitle] = useState("Pflanzen giessen");

  return (
    <Section id="overlays" title="Bottom Sheet · Dialog · Bestätigung · Menü · Toast">
      <Panel className="flex flex-col gap-5">
        <span className="text-body-sm text-ink-muted">
          Unter 1024 px öffnen sich Sheets von unten, ab 1024 px als Dialog. Esc, Klick auf den
          Hintergrund und «Schliessen» schliessen; der Fokus kehrt zum Auslöser zurück.
        </span>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSheet(true)}>Neue Aufgabe (Sheet)</Button>
          <Button variant="secondary" onClick={() => setWide(true)}>
            Aufgabe bearbeiten (breit)
          </Button>
          <Button variant="danger-ghost" icon={TrashIcon20} onClick={() => setConfirm(true)}>
            Aufgabe löschen
          </Button>
          <Button variant="danger-ghost" onClick={() => setTyped(true)}>
            Haushalt löschen
          </Button>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                message: "«Altpapier rausbringen» erledigt",
                action: {
                  label: "Rückgängig",
                  icon: ArrowUturnLeftIcon,
                  onClick: () => toast.show({ message: "Rückgängig gemacht", tone: "info" }),
                },
              })
            }
          >
            Toast mit Rückgängig
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                message: "«Milch» konnte nicht gespeichert werden",
                tone: "error",
                action: { label: "Nochmals", onClick: () => {} },
              })
            }
          >
            Fehler-Toast
          </Button>
          <span className="h-11 w-px bg-line" />
          <Menu
            aria-label="Kontomenü"
            width={260}
            align="start"
            header={
              <div className="flex items-center gap-2.5">
                <Avatar initials="NA" color={6} size={36} />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">Nevio</span>
                  <span className="text-[13px] text-ink-muted">nevio@example.com</span>
                </span>
              </div>
            }
            items={[
              { label: "Profil", icon: UserCircleIcon, onSelect: () => {} },
              { label: "Haushalt", icon: UsersIcon, onSelect: () => {} },
              "separator",
              {
                label: "Abmelden",
                icon: ArrowRightStartOnRectangleIcon,
                danger: true,
                onSelect: () => toast.show({ message: "Abgemeldet (Demo)", tone: "info" }),
              },
            ]}
            trigger={(props) => (
              <button
                {...props}
                type="button"
                aria-label="Kontomenü"
                className="flex size-11 cursor-pointer items-center justify-center rounded-pill"
              >
                <Avatar initials="NA" color={6} size={34} />
              </button>
            )}
          />
          <Menu
            aria-label="Aktionen"
            align="start"
            items={[
              { label: "Bearbeiten", icon: PencilIcon, onSelect: () => {} },
              { label: "Diesmal überspringen", icon: ForwardIcon, onSelect: () => {} },
              { label: "Neu zuweisen…", icon: UserIcon, onSelect: () => {} },
              {
                label: "In den Kalender verschieben",
                icon: CalendarOutline,
                disabled: true,
                onSelect: () => {},
              },
              "separator",
              { label: "Aufgabe löschen", icon: TrashIcon, danger: true, onSelect: () => {} },
            ]}
            trigger={(props) => (
              <IconButton {...props} aria-label="Mehr" icon={EllipsisHorizontalIcon} />
            )}
          />
        </div>
      </Panel>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Neue Aufgabe"
        footer={
          <>
            <Button
              variant="secondary"
              size="compact"
              className="max-lg:hidden"
              onClick={() => setSheet(false)}
            >
              Abbrechen
            </Button>
            <Button
              size="lg"
              className="flex-1 lg:h-11 lg:flex-none lg:px-5.5 lg:text-[15px]"
              onClick={() => {
                setSheet(false);
                toast.show({ message: `«${title}» hinzugefügt` });
              }}
            >
              Aufgabe hinzufügen
            </Button>
          </>
        }
      >
        <TextField
          label="Titel"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          data-autofocus
        />
        <FilterChipGroup aria-label="Optionen">
          <FilterChip>Heute</FilterChip>
          <FilterChip selected>Alle 4 Tage</FilterChip>
        </FilterChipGroup>
        <Textarea label="Notizen" optional maxLength={500} />
      </Sheet>

      <Sheet
        open={wide}
        onClose={() => setWide(false)}
        title="Aufgabe bearbeiten"
        size="lg"
        footer={
          <>
            <Button
              variant="danger-ghost"
              size="compact"
              icon={TrashIcon20}
              className="mr-auto"
              onClick={() => {
                setWide(false);
                setConfirm(true);
              }}
            >
              Aufgabe löschen
            </Button>
            <Button variant="secondary" size="compact" onClick={() => setWide(false)}>
              Abbrechen
            </Button>
            <Button size="compact" onClick={() => setWide(false)}>
              Speichern
            </Button>
          </>
        }
      >
        <TextField label="Titel" defaultValue="Bad putzen" />
        <Textarea
          label="Notizen"
          optional
          defaultValue="Dusche, Lavabo, WC und Spiegel. Zum Schluss feucht aufnehmen."
        />
        <RecurrenceBadge variant="pill" rule="Jeden Samstag" rotation={["Nevio", "Anna"]} />
        {Array.from({ length: 8 }, (_, index) => (
          <ListRow key={index} title={`Zeile ${index + 1} (zum Scrollen)`} />
        ))}
      </Sheet>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="«Bad putzen» löschen?"
        text="Die Aufgabe verschwindet für Nevio und Anna."
        confirmLabel="Löschen"
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 800));
          setConfirm(false);
          toast.show({
            message: "«Bad putzen» gelöscht",
            action: { label: "Rückgängig", icon: ArrowUturnLeftIcon, onClick: () => {} },
          });
        }}
      />

      <ConfirmDialog
        open={typed}
        onClose={() => setTyped(false)}
        icon={ExclamationTriangleIcon}
        title="Haushalt löschen?"
        text="Alle Aufgaben, Listen und Termine beider Mitglieder werden endgültig entfernt. Das lässt sich nicht rückgängig machen."
        confirmLabel="Haushalt löschen"
        confirmText="Musterstrasse 12"
        onConfirm={() => setTyped(false)}
      />
    </Section>
  );
}

function FeedbackSection() {
  return (
    <Section id="feedback" title="Leerer Zustand · Skeleton · Hinweis">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4">
        <EmptyState
          icon={CheckBadgeIcon}
          title="Alles erledigt 🎉"
          text="Nichts mehr auf der Liste. Geniess den Abend."
          action={
            <Button variant="secondary" size="compact" icon={PlusIcon}>
              Aufgabe hinzufügen
            </Button>
          }
        />
        <SkeletonList />
        <div className="flex flex-col gap-2.5">
          <InlineAlert tone="warning" title="Keine Verbindung">
            Änderungen werden synchronisiert, sobald du wieder online bist.
          </InlineAlert>
          <InlineAlert tone="danger" action={{ label: "Nochmals versuchen", onClick: () => {} }}>
            Kalender konnte nicht geladen werden.
          </InlineAlert>
          <InlineAlert tone="success">Anna ist Musterstrasse 12 beigetreten.</InlineAlert>
          <InlineAlert tone="info">
            Abwechselnde Aufgaben gehen nach jedem Erledigen an die nächste Person.
          </InlineAlert>
        </div>
      </div>
    </Section>
  );
}

export default function UiGalleryPage() {
  return (
    <main className="mx-auto flex max-w-300 flex-col gap-16 px-4 pt-14 pb-30 sm:px-6">
      <header className="flex flex-col gap-3.5">
        <span className="text-body-sm font-semibold text-brand-strong">
          /dev/ui · nur Entwicklung
        </span>
        <h1 className="font-display text-[56px] leading-15 font-[450] tracking-[-0.02em]">
          Komponenten
        </h1>
        <p className="max-w-160 text-lg leading-7 text-ink-muted">
          Alle Bausteine mit ihren Zuständen, in der Reihenfolge von{" "}
          <code className="font-mono text-[15px]">Components.dc.html</code>. Hover, gedrückt und
          Fokus sind eingefroren; Checkbox, Schalter, Chips, Auswahlen und Overlays sind live. Die
          Navigation folgt in Slice D.
        </p>
      </header>
      <ButtonsSection />
      <FieldsSection />
      <ControlsSection />
      <ChipsSection />
      <RowsSection />
      <OverlaysSection />
      <FeedbackSection />
    </main>
  );
}
