import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { formatNumericDate } from "../../lib/format";
import { householdCopy, lifecycleCopy, roleLabels, terms } from "../../lib/copy";
import type { Member } from "../../types";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { IconButton } from "../ui/IconButton";
import { Menu, type MenuEntry } from "../ui/Menu";
import { HouseholdSection } from "./HouseholdSection";

/**
 * «Mitglieder» (HH-06): avatar, name with «Du», role and join date. Phones show the role in
 * the second line, desktop as a badge. The «⋯» menu (Phase 9 D83) shows the entries
 * `menuItems` returns for a row; rows without any get no button.
 */
export function MemberList({
  members,
  myUid,
  timeZone,
  menuItems,
}: {
  members: Member[];
  myUid: string;
  timeZone: string;
  menuItems?: (member: Member) => MenuEntry[];
}) {
  return (
    <HouseholdSection title="Mitglieder" count={members.length} flush>
      <ul>
        {members.map((member) => {
          const role = roleLabels[member.role];
          const items = menuItems?.(member) ?? [];
          const label = lifecycleCopy.menuLabel(member.displayName, member.uid === myUid);
          return (
            <li
              key={member.uid}
              className="flex min-h-16 items-center gap-3 border-t border-line py-2 pr-1.5 pl-4 first:border-t-0 lg:pr-3 lg:pl-5 lg:first:border-t"
            >
              <Avatar initials={member.initials} color={member.avatarColor} size={40} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-body font-semibold text-ink">
                  <span className="truncate">{member.displayName}</span>
                  {member.uid === myUid && (
                    <Badge variant="brand" className="h-5 px-1.5 text-[11px]">
                      {terms.you}
                    </Badge>
                  )}
                </span>
                <span className="text-[13px] leading-[18px] text-ink-muted tabular-nums">
                  <span className="lg:hidden">{role} · </span>
                  {householdCopy.memberSince} {formatNumericDate(member.joinedAt, timeZone)}
                </span>
              </span>
              <Badge
                variant={member.role === "owner" ? "brand" : "neutral"}
                className="hidden lg:inline-flex"
              >
                {role}
              </Badge>
              {items.length > 0 && (
                <Menu
                  aria-label={label}
                  items={items}
                  trigger={(props) => (
                    <IconButton {...props} aria-label={label} icon={EllipsisHorizontalIcon} />
                  )}
                />
              )}
            </li>
          );
        })}
      </ul>
    </HouseholdSection>
  );
}
