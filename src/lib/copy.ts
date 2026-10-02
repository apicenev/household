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
