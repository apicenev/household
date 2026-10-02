import {
  BoltIcon,
  CalendarIcon,
  CheckCircleIcon,
  HomeIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import {
  BoltIcon as BoltSolid,
  CalendarIcon as CalendarSolid,
  CheckCircleIcon as CheckCircleSolid,
  HomeIcon as HomeSolid,
  ShoppingBagIcon as ShoppingBagSolid,
  UsersIcon as UsersSolid,
} from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import { areas } from "../../lib/copy";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type AreaKey = "dashboard" | "tasks" | "shopping" | "calendar" | "activity" | "household";

export interface NavItem {
  key: AreaKey;
  label: string;
  path: string;
  /** 24/outline when inactive */
  icon: Icon;
  /** 24/solid when active */
  activeIcon: Icon;
}

export const navItems: Record<AreaKey, NavItem> = {
  dashboard: {
    key: "dashboard",
    label: areas.dashboard,
    path: "/dashboard",
    icon: HomeIcon,
    activeIcon: HomeSolid,
  },
  tasks: {
    key: "tasks",
    label: areas.tasks,
    path: "/tasks",
    icon: CheckCircleIcon,
    activeIcon: CheckCircleSolid,
  },
  shopping: {
    key: "shopping",
    label: areas.shopping,
    path: "/shopping",
    icon: ShoppingBagIcon,
    activeIcon: ShoppingBagSolid,
  },
  calendar: {
    key: "calendar",
    label: areas.calendar,
    path: "/calendar",
    icon: CalendarIcon,
    activeIcon: CalendarSolid,
  },
  activity: {
    key: "activity",
    label: areas.activity,
    path: "/activity",
    icon: BoltIcon,
    activeIcon: BoltSolid,
  },
  household: {
    key: "household",
    label: areas.household,
    path: "/household",
    icon: UsersIcon,
    activeIcon: UsersSolid,
  },
};

/** Tab bar: Start · Aufgaben · + · Einkauf · Kalender (UI-02). */
export const tabItems = {
  left: [navItems.dashboard, navItems.tasks],
  right: [navItems.shopping, navItems.calendar],
};

/** Sidebar: primary and secondary navigation (UI-03). */
export const sidebarItems = {
  primary: [navItems.dashboard, navItems.tasks, navItems.shopping, navItems.calendar],
  secondary: [navItems.activity, navItems.household],
};

/** Area for a pathname, e.g. "/tasks/123" → tasks. */
export function areaForPath(pathname: string): NavItem | undefined {
  return Object.values(navItems).find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
}
