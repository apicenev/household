import {
  ArrowRightStartOnRectangleIcon,
  UserCircleIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth/useAuth";
import { useCurrentMember } from "../../lib/auth/useCurrentMember";
import { actions, areas } from "../../lib/copy";
import { Avatar } from "../ui/Avatar";
import { Menu, type MenuTriggerProps } from "../ui/Menu";

/** «Kontomenü»: Profil, Haushalt, Abmelden (UI-04). Shared by the top bar and the sidebar. */
export function AccountMenu({
  trigger,
  placement = "bottom",
  align = "end",
}: {
  trigger: (props: MenuTriggerProps) => ReactNode;
  placement?: "bottom" | "top";
  align?: "start" | "end";
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const member = useCurrentMember();

  return (
    <Menu
      aria-label="Kontomenü"
      width={260}
      placement={placement}
      align={align}
      trigger={trigger}
      header={
        <div className="flex items-center gap-2.5">
          <Avatar initials={member.initials} color={member.avatarColor} size={36} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold">{member.name}</span>
            <span className="truncate text-[13px] text-ink-muted">{member.email}</span>
          </span>
        </div>
      }
      items={[
        { label: "Profil", icon: UserCircleIcon, onSelect: () => navigate("/household#profil") },
        { label: areas.household, icon: UsersIcon, onSelect: () => navigate("/household") },
        "separator",
        {
          label: actions.logout,
          icon: ArrowRightStartOnRectangleIcon,
          danger: true,
          onSelect: () => {
            void logout().then(() => navigate("/login", { replace: true }));
          },
        },
      ]}
    />
  );
}
