/**
 * Shared UI wording (de-CH), so the same words are used everywhere.
 * Terms follow the glossary in requirements §5.2. Screen-specific strings live next to
 * the components that use them.
 */

export const actions = {
  save: "Speichern",
  cancel: "Abbrechen",
  delete: "Löschen",
  undo: "Rückgängig",
  showAll: "Alle anzeigen",
  close: "Schliessen",
  edit: "Bearbeiten",
  retry: "Nochmals versuchen",
  back: "Zurück",
  more: "Mehr",
  remove: "Entfernen",
  login: "Anmelden",
  logout: "Abmelden",
} as const;

export const loadingLabels = {
  saving: "Speichert…",
  deleting: "Löscht…",
  joining: "Tritt bei…",
  loading: "Lädt",
} as const;

/** Section and area names (navigation, page titles). */
export const areas = {
  dashboard: "Start",
  tasks: "Aufgaben",
  shopping: "Einkauf",
  calendar: "Kalender",
  activity: "Aktivität",
  household: "Haushalt",
  quickAdd: "Schnellerfassung",
} as const;

export const terms = {
  task: "Aufgabe",
  item: "Artikel",
  event: "Termin",
  member: "Mitglied",
  owner: "Besitzer",
  assignee: "Zuständig",
  unassigned: "Nicht zugewiesen",
  everyone: "Alle",
  today: "Heute",
  tomorrow: "Morgen",
  yesterday: "Gestern",
  overdue: "Überfällig",
  upcoming: "Demnächst",
  recentlyDone: "Kürzlich erledigt",
  done: "Erledigt",
  markDone: "Abhaken",
  purchased: "Gekauft",
  clearPurchased: "Gekaufte entfernen",
  frequentlyBought: "Oft gekauft",
  allDay: "Ganztägig",
  repeat: "Wiederholen",
  rotate: "Abwechseln",
  you: "Du",
  offline: "Offline",
} as const;

export const priorityLabels = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
} as const;

export const offlineMessage = {
  title: "Keine Verbindung",
  text: "Änderungen werden synchronisiert, sobald du wieder online bist.",
} as const;

/** Member roles (requirements §3). */
export const roleLabels = {
  owner: "Besitzer",
  member: "Mitglied",
} as const;

/** Names of the avatar colours 1–8, for screen readers (HH-05). */
export const avatarColorNames = {
  1: "Terrakotta",
  2: "Honig",
  3: "Olive",
  4: "Salbei",
  5: "Seegrün",
  6: "Taubenblau",
  7: "Lavendel",
  8: "Rosé",
} as const;

/** «1 Mitglied» / «2 Mitglieder» */
export function memberCountLabel(count: number): string {
  return count === 1 ? "1 Mitglied" : `${count} Mitglieder`;
}

/** Household and invite wording shared by onboarding and the Haushalt page. */
export const householdCopy = {
  memberSince: "Dabei seit",
  nameEmpty: "Gib einen Namen ein.",
  nameTooLong: "Der Name darf höchstens 50 Zeichen lang sein.",
  creating: "Erstellt…",
  codeFormatHint: "Format: drei Buchstaben, Bindestrich, vier Ziffern",
  codeFound: "Code gefunden",
  codeNotFound: "Diesen Code gibt es nicht. Prüfe die Schreibweise.",
  codeExpired: "Dieser Code ist abgelaufen. Bitte um einen neuen.",
  copyCode: "Code kopieren",
  copied: "Kopiert",
  newCode: "Neuer Code",
} as const;

/** Task wording (Phase 3): list, filters, sheet, toasts and derived states D12–D25. */
export const taskCopy = {
  groups: {
    overdue: "Überfällig",
    today: "Heute",
    upcoming: "Demnächst",
    none: "Ohne Datum",
  },
  filters: {
    label: "Filter",
    mine: "Meine",
    unassigned: "Nicht zugewiesen",
    overdue: "Überfällig",
    today: "Heute",
    week: "Diese Woche",
    noDate: "Ohne Datum",
    highPriority: "Priorität Hoch",
    reset: "Zurücksetzen",
  },
  noResults: "Keine passenden Aufgaben",
  noResultsText: "Entferne einen Filter.",
  resetFilters: "Filter zurücksetzen",
  noneYet: "Noch keine Aufgaben",
  noneYetText: "Erfasse, was bei euch ansteht.",
  allDone: "Alles erledigt 🎉",
  allDoneText: "Nichts mehr offen.",
  addTask: "Aufgabe hinzufügen",
  newTask: "Neue Aufgabe",
  editTask: "Aufgabe bearbeiten",
  deleteTask: "Aufgabe löschen",
  loadError: "Aufgaben konnten nicht geladen werden.",
  done: "Erledigt",
  details: "Aufgabendetails",
  noRepeat: "Wiederholt sich nicht",
  dueOn: "Fällig am",
  priority: "Priorität",
  title: "Titel",
  notes: "Notizen",
  nobody: "Niemand",
  titleEmpty: "Gib der Aufgabe einen Namen.",
  titlePlaceholder: "Was ist zu tun?",
  moreOptions: "Mehr Optionen",
  deletedElsewhere: "Diese Aufgabe wurde gelöscht.",
  completedElsewhere: "Diese Aufgabe wurde erledigt.",
  /** «Abhaken: Bad putzen» */
  checkLabel: (title: string) => `${terms.markDone}: ${title}`,
  /** «Bad putzen wieder öffnen» */
  reopenLabel: (title: string) => `${title} wieder öffnen`,
  /** «Bad putzen» erledigt toast (B6). */
  completedToast: (title: string) => `«${title}» erledigt`,
  /** Recurring: «Bad putzen» erledigt · als Nächstes ist Anna dran (Phase 4 D29). */
  completedToastWithNote: (title: string, note: string) => `«${title}» erledigt · ${note}`,
  /** Schnellerfassung status line (B13). */
  addedStatus: (title: string) => `«${title}» zu den Aufgaben hinzugefügt`,
  /** Delete confirmation title. */
  deleteTitle: (title: string) => `«${title}» löschen?`,
  /** D22: «Die Aufgabe verschwindet für Nevio, Anna und Mia.» */
  deleteText: (names: string[]) =>
    names.length < 2
      ? "Die Aufgabe wird gelöscht."
      : `Die Aufgabe verschwindet für ${new Intl.ListFormat("de-CH", { type: "conjunction" }).format(names)}.`,
  /** Detail panel rotation block heading and screen-reader prefix in rows (Phase 4). */
  rotation: "Abwechseln",
  rotationSr: "Abwechselnd: ",
  /** Delete dialog of a recurring task (RTK-08, Phase 4 B8). */
  series: {
    /** «Diese Aufgabe wiederholt sich jeden Samstag. Was möchtest du löschen?» */
    text: (rule: string) => `Diese Aufgabe wiederholt sich ${rule}. Was möchtest du löschen?`,
    choiceLabel: "Was möchtest du löschen?",
    one: "Nur diese",
    /** «Nur Sa., 3. Okt. Die nächste bleibt.» */
    oneHint: (date: string) => `Nur ${date.endsWith(".") ? date : `${date}.`} Die nächste bleibt.`,
    all: "Ganze Serie",
    /** «Alle künftigen Samstage.» for a weekly task on one day, otherwise generic. */
    allHint: (weekdayPlural?: string) =>
      weekdayPlural ? `Alle künftigen ${weekdayPlural}.` : "Alle künftigen Wiederholungen.",
    oneCta: "Nur diese löschen",
    allCta: "Ganze Serie löschen",
  },
  /** Desktop summary «5 offen · 1 überfällig · 2 heute fällig» (B4). */
  summary: (open: number, overdue: number, today: number) =>
    `${open} offen · ${overdue} überfällig · ${today} heute fällig`,
} as const;

/** Shopping wording (Phase 5): `Shopping`, Artikel-Sheet, Schnellerfassung, D34–D44. */
export const shoppingCopy = {
  addLabel: "Artikel hinzufügen",
  addPlaceholderDesktop: "Artikel hinzufügen und Enter drücken",
  addButton: "Hinzufügen",
  suggestions: "Vorschläge",
  empty: "Alles im Wagen",
  emptyText: "Füge oben etwas hinzu oder wähle aus «Oft gekauft».",
  loadError: "Einkauf konnte nicht geladen werden.",
  deletedElsewhere: "Dieser Artikel wurde gelöscht.",
  editItem: "Artikel bearbeiten",
  deleteItem: "Artikel löschen",
  name: "Name",
  quantity: "Menge",
  unit: "Einheit",
  category: "Kategorie",
  notes: "Notizen",
  less: "Weniger",
  more: "Mehr",
  /** D37: stepper value without a quantity. */
  noQuantity: "–",
  nameEmpty: "Gib einen Namen ein.",
  nameTooLong: "Der Name darf höchstens 100 Zeichen lang sein.",
  nameReserved: "Diesen Namen kann ich nicht speichern.",
  /** B4: rename to another open item. */
  nameDuplicate: "Steht schon auf der Liste.",
  pending: "Warte auf Sync",
  pendingNew: "Warte auf Sync · neu",
  pendingChecked: "Warte auf Sync · gekauft",
  quickAddPlaceholder: "Was braucht ihr?",
  quickAddCta: "Auf die Liste",
  /** Top bar «4 offen» / «Alles erledigt» (B13). */
  openCount: (open: number) => (open === 0 ? "Alles erledigt" : `${open} offen`),
  /** Suggestion row ««Mi» hinzufügen» (B9). */
  addRow: (query: string) => `«${query}» hinzufügen`,
  /** Suggestion meta «12× gekauft». */
  timesBought: (count: number) => `${count}× gekauft`,
  /** «Oft gekauft» chip and Schnellerfassung chip label for screen readers. */
  addNamed: (name: string) => `${name} hinzufügen`,
  checkLabel: (name: string) => `${name} als gekauft markieren`,
  uncheckLabel: (name: string) => `${name} zurück auf die Liste`,
  boughtSection: (count: number) => `${terms.purchased} (${count})`,
  boughtBy: (name: string) => `von ${name}`,
  /** B2: a stored quantity the stepper can't show, until the stepper is touched. */
  previousQuantity: (quantity: string) => `Bisher: ${quantity}`,
  /** D36 */
  duplicateHint: (name: string) => `${name} steht schon auf der Liste.`,
  purchasedToast: (name: string) => `«${name}» gekauft`,
  deletedToast: (name: string) => `«${name}» gelöscht`,
  /** D41 */
  clearedToast: (count: number) => `${count} Artikel entfernt`,
  /** Schnellerfassung status line (D43). */
  addedStatus: (name: string) => `«${name}» zum Einkauf hinzugefügt`,
  /**
   * Desktop summary (D42): «4 offen · 4 im Wagen · mit Anna geteilt». `others` are the other
   * members' names; alone, the last part is left out.
   */
  summary: (open: number, bought: number, others: readonly string[]) => {
    const base = `${open} offen · ${bought} im Wagen`;
    if (others.length === 0) return base;
    const rest = others.length - 2;
    const shared =
      rest > 0
        ? `${others[0]}, ${others[1]} und ${rest} ${rest === 1 ? "weiteren Person" : "weiteren Personen"}`
        : new Intl.ListFormat("de-CH", { type: "conjunction" }).format(others);
    return `${base} · mit ${shared} geteilt`;
  },
} as const;

/** RecurrencePicker and RotationPicker (Phase 4, `RecurrencePicker.dc.html`, `Sheets`). */
export const recurrenceCopy = {
  label: terms.repeat,
  /** The chips tasks offer (B2); «Benutzerdefiniert» stays hidden. */
  freqs: {
    none: "Nie",
    daily: "Täglich",
    weekly: "Wöchentlich",
    nweeks: "Alle N Wochen",
    monthly: "Monatlich",
    yearly: "Jährlich",
    ndays: "Alle N Tage",
  },
  noRepeat: "Wiederholt sich nicht",
  every: "Alle",
  weeks: "Wochen",
  days: "Tage",
  less: "Weniger",
  more: "Mehr",
  onDays: "An diesen Tagen",
  rotation: terms.rotate,
  rotationHint: "Nach jedem Erledigen ist die nächste Person dran.",
  /** «Abwechseln ist an: diesmal Nevio, danach Anna.» under «Zuständig». */
  rotationOn: (first: string, second: string) =>
    `Abwechseln ist an: diesmal ${first}, danach ${second}.`,
  thisTime: "Diesmal",
  moveUp: (name: string) => `${name} nach oben`,
  moveDown: (name: string) => `${name} nach unten`,
  moveForward: (name: string) => `${name} nach vorne`,
  /** D30 on /household. */
  orderLabel: "Reihenfolge beim Abwechseln",
  orderHelper: "Neue abwechselnde Aufgaben starten in dieser Reihenfolge.",
} as const;

const listFormat = (names: readonly string[]) =>
  new Intl.ListFormat("de-CH", { type: "conjunction" }).format(names);

/** Calendar wording (Phase 6): `Calendar`, Termin-Sheet, Termin-Detail, D45–D58. */
export const calendarCopy = {
  month: "Monat",
  upcoming: terms.upcoming,
  viewLabel: "Ansicht",
  today: terms.today,
  prevMonth: "Vorheriger Monat",
  nextMonth: "Nächster Monat",
  selectedDay: "Ausgewählter Tag",
  newEvent: "Neuer Termin",
  editEvent: "Termin bearbeiten",
  addEvent: "Termin hinzufügen",
  deleteEvent: "Termin löschen",
  /** Schnellerfassung CTA. */
  saveQuick: "Termin speichern",
  quickAddPlaceholder: "Was steht an?",
  moreOptions: "Mehr Optionen",
  nothingPlanned: "Nichts geplant",
  /** D51 */
  upcomingEmptyText: "In den nächsten 60 Tagen steht nichts an.",
  /** D50 */
  loadError: "Kalender konnte nicht geladen werden.",
  /** D52 */
  deletedElsewhere: "Dieser Termin wurde gelöscht.",
  back: areas.calendar,
  title: "Titel",
  allDay: terms.allDay,
  start: "Beginn",
  end: "Ende",
  date: "Datum",
  time: "Uhrzeit",
  participants: "Für",
  everyone: terms.everyone,
  category: "Kategorie",
  description: "Beschreibung",
  noRepeat: "Wiederholt sich nicht",
  titleEmpty: "Gib einen Titel ein.",
  titleTooLong: "Der Titel darf höchstens 200 Zeichen lang sein.",
  descriptionTooLong: "Die Beschreibung darf höchstens 2000 Zeichen lang sein.",
  /** D48 */
  endBeforeStart: "Das Ende darf nicht vor dem Beginn liegen.",
  tooLong: "Ein Termin darf höchstens 366 Tage dauern.",
  /** «Beginn, Datum» / «Ende, Uhrzeit» for the D48 pills. */
  pickerLabel: (row: string, part: string) => `${row}, ${part}`,
  /** «1 Termin» / «2 Termine» */
  eventCount: (count: number) => `${count} ${count === 1 ? "Termin" : "Termine"}`,
  /** «Tag 3 von 8» (D54) */
  dayOf: (day: number, of: number) => `Tag ${day} von ${of}`,
  /** «8 Tage» / «1 Tag» */
  days: (count: number) => `${count} ${count === 1 ? "Tag" : "Tage"}`,
  /** D55: «bis Sa.» / «bis 02:00» */
  until: (label: string) => `bis ${label}`,
  /** Desktop cell overflow «+2 weitere» (B7). */
  more: (count: number) => `+${count} weitere`,
  /** Day cell: «Sa., 3. Okt., heute, 2 Termine» / «…, keine Termine» (D57). */
  cellLabel: (date: string, isToday: boolean, count: number) =>
    [
      date,
      ...(isToday ? ["heute"] : []),
      count === 0 ? "keine Termine" : `${count} ${count === 1 ? "Termin" : "Termine"}`,
    ].join(", "),
  /** Detail and card lines joined with « · ». */
  meta: (...parts: readonly string[]) => parts.filter(Boolean).join(" · "),
  /** D53 */
  deleteTitle: (title: string) => `«${title}» löschen?`,
  deleteText: (names: readonly string[]) =>
    names.length < 2
      ? "Der Termin wird gelöscht."
      : `Der Termin verschwindet für ${listFormat(names)}.`,
  deletedToast: (title: string) => `«${title}» gelöscht`,
  /** Schnellerfassung status line (D56). */
  addedStatus: (title: string) => `«${title}» zum Kalender hinzugefügt`,
} as const;
