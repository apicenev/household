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
import type { ShopCategory } from "../../types";

export type EventCategory = "social" | "appointment" | "travel" | "home" | "reminder" | "other";
export type { ShopCategory } from "../../types";

export interface CategoryStyle {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Dot / icon colour */
  main: string;
  dot: string;
  /** Soft background alone (24 px icon tile of a shopping group). */
  soft: string;
  /** Soft background + ink for the pill */
  pill: string;
}

export const eventCategories: Record<EventCategory, CategoryStyle> = {
  social: {
    label: "Freizeit",
    icon: UsersIcon,
    main: "text-event-social",
    dot: "bg-event-social",
    soft: "bg-event-social-soft",
    pill: "bg-event-social-soft text-event-social-ink",
  },
  appointment: {
    label: "Termin",
    icon: ClockIcon,
    main: "text-event-appointment",
    dot: "bg-event-appointment",
    soft: "bg-event-appointment-soft",
    pill: "bg-event-appointment-soft text-event-appointment-ink",
  },
  travel: {
    label: "Reise",
    icon: PaperAirplaneIcon,
    main: "text-event-travel",
    dot: "bg-event-travel",
    soft: "bg-event-travel-soft",
    pill: "bg-event-travel-soft text-event-travel-ink",
  },
  home: {
    label: "Zuhause",
    icon: HomeIcon,
    main: "text-event-home",
    dot: "bg-event-home",
    soft: "bg-event-home-soft",
    pill: "bg-event-home-soft text-event-home-ink",
  },
  reminder: {
    label: "Erinnerung",
    icon: BellIcon,
    main: "text-event-reminder",
    dot: "bg-event-reminder",
    soft: "bg-event-reminder-soft",
    pill: "bg-event-reminder-soft text-event-reminder-ink",
  },
  other: {
    label: "Sonstiges",
    icon: TagIcon,
    main: "text-event-other",
    dot: "bg-event-other",
    soft: "bg-event-other-soft",
    pill: "bg-event-other-soft text-event-other-ink",
  },
};

export const shopCategories: Record<ShopCategory, CategoryStyle> = {
  groceries: {
    label: "Lebensmittel",
    icon: ShoppingCartIcon,
    main: "text-shop-groceries",
    dot: "bg-shop-groceries",
    soft: "bg-shop-groceries-soft",
    pill: "bg-shop-groceries-soft text-shop-groceries-ink",
  },
  household: {
    label: "Haushalt",
    icon: SparklesIcon,
    main: "text-shop-household",
    dot: "bg-shop-household",
    soft: "bg-shop-household-soft",
    pill: "bg-shop-household-soft text-shop-household-ink",
  },
  pharmacy: {
    label: "Apotheke",
    icon: HeartIcon,
    main: "text-shop-pharmacy",
    dot: "bg-shop-pharmacy",
    soft: "bg-shop-pharmacy-soft",
    pill: "bg-shop-pharmacy-soft text-shop-pharmacy-ink",
  },
  other: {
    label: "Sonstiges",
    icon: TagIcon,
    main: "text-shop-other",
    dot: "bg-shop-other",
    soft: "bg-shop-other-soft",
    pill: "bg-shop-other-soft text-shop-other-ink",
  },
};
