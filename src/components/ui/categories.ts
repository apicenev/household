import {
  BellIcon,
  ClockIcon,
  HeartIcon,
  HomeIcon,
  PaperAirplaneIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
} from "@heroicons/react/16/solid";
import type { ComponentType, SVGProps } from "react";

export type EventCategory = "social" | "appointment" | "travel" | "home" | "reminder" | "other";
export type ShopCategory = "groceries" | "household" | "pharmacy" | "other";

export interface CategoryStyle {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Dot / icon colour */
  main: string;
  dot: string;
  /** Soft background + ink for the pill */
  pill: string;
}

export const eventCategories: Record<EventCategory, CategoryStyle> = {
  social: {
    label: "Freizeit",
    icon: UsersIcon,
    main: "text-event-social",
    dot: "bg-event-social",
    pill: "bg-event-social-soft text-event-social-ink",
  },
  appointment: {
    label: "Termin",
    icon: ClockIcon,
    main: "text-event-appointment",
    dot: "bg-event-appointment",
    pill: "bg-event-appointment-soft text-event-appointment-ink",
  },
  travel: {
    label: "Reise",
    icon: PaperAirplaneIcon,
    main: "text-event-travel",
    dot: "bg-event-travel",
    pill: "bg-event-travel-soft text-event-travel-ink",
  },
  home: {
    label: "Zuhause",
    icon: HomeIcon,
    main: "text-event-home",
    dot: "bg-event-home",
    pill: "bg-event-home-soft text-event-home-ink",
  },
  reminder: {
    label: "Erinnerung",
    icon: BellIcon,
    main: "text-event-reminder",
    dot: "bg-event-reminder",
    pill: "bg-event-reminder-soft text-event-reminder-ink",
  },
  other: {
    label: "Sonstiges",
    icon: TagIcon,
    main: "text-event-other",
    dot: "bg-event-other",
    pill: "bg-event-other-soft text-event-other-ink",
  },
};

export const shopCategories: Record<ShopCategory, CategoryStyle> = {
  groceries: {
    label: "Lebensmittel",
    icon: ShoppingCartIcon,
    main: "text-shop-groceries",
    dot: "bg-shop-groceries",
    pill: "bg-shop-groceries-soft text-shop-groceries-ink",
  },
  household: {
    label: "Haushalt",
    icon: SparklesIcon,
    main: "text-shop-household",
    dot: "bg-shop-household",
    pill: "bg-shop-household-soft text-shop-household-ink",
  },
  pharmacy: {
    label: "Apotheke",
    icon: HeartIcon,
    main: "text-shop-pharmacy",
    dot: "bg-shop-pharmacy",
    pill: "bg-shop-pharmacy-soft text-shop-pharmacy-ink",
  },
  other: {
    label: "Sonstiges",
    icon: TagIcon,
    main: "text-shop-other",
    dot: "bg-shop-other",
    pill: "bg-shop-other-soft text-shop-other-ink",
  },
};
