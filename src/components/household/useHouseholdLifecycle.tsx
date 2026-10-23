import {
  ArrowRightStartOnRectangleIcon,
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  UserMinusIcon,
} from "@heroicons/react/24/outline";
import { useRef, useState, type ReactNode } from "react";
import { canLeave, type LeaveState } from "../../domain/member";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { lifecycleCopy } from "../../lib/copy";
import { firestoreErrorMessage } from "../../lib/firestoreErrors";
import { useLoadedHousehold } from "../../lib/household/useHousehold";
import {
  deleteHousehold,
  handOverHousehold,
  leaveHousehold,
  removeMember,
} from "../../services/householdService";
import type { Member } from "../../types";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useToast } from "../ui/toastContext";

type Dialog =
  | { kind: "leave" }
  | { kind: "delete" }
  | { kind: "handOver"; member: Member }
  | { kind: "remove"; member: Member };

export interface HouseholdLifecycle {
  /** Why «Haushalt verlassen» is off, or `ok` (D84, D96). */
  leaveState: LeaveState;
  /** Leave / remove / hand over / delete can run now: online (D91), tasks loaded (B3), no demo. */
  canAct: boolean;
  /** Owner of a household whose delete was interrupted (D89). */
  interrupted: boolean;
  openLeave: () => void;
  openDelete: () => void;
  openHandOver: (member: Member) => void;
  openRemove: (member: Member) => void;
  resumeDelete: () => void;
  /** The confirm dialogs; render once on the page. */
  dialogs: ReactNode;
}

/**
 * Household lifecycle actions (Phase 9 slice A): leave (HH-08), remove (HH-09), hand over
 * (HH-12) and delete (HH-10), each behind its confirm dialog (designed, D84–D86). Success
 * shows a toast (D87, D85, D86); leaving and deleting then lead to onboarding on their own,
 * because the profile's householdId is cleared. Errors show the write error toast.
 */
export function useHouseholdLifecycle(): HouseholdLifecycle {
  const { household, members, me, isOwner, tasks, tasksLoading, tasksError } = useLoadedHousehold();
  const online = useOnlineStatus();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const resuming = useRef(false);

  const leaveState: LeaveState = me ? canLeave(household, me.uid) : "alone";
  const canAct = online && !household.demo && !tasksLoading && !tasksError;
  const close = () => setDialog(null);

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      setDialog(null);
      toast.show({ message: success });
    } catch (error) {
      toast.show({ message: firestoreErrorMessage(error), tone: "error" });
    }
  }

  const name = household.name;
  const remove = async () => {
    if (me) await run(() => deleteHousehold(household, me.uid), lifecycleCopy.deleted(name));
  };

  let content: ReactNode = null;
  if (dialog?.kind === "leave" && me) {
    content = (
      <ConfirmDialog
        open
        onClose={close}
        onConfirm={() => run(() => leaveHousehold(household, me, tasks), lifecycleCopy.left(name))}
        title={lifecycleCopy.leaveTitle}
        text={lifecycleCopy.leaveText}
        confirmLabel={lifecycleCopy.leaveConfirm}
        loadingLabel={lifecycleCopy.leaving}
        icon={ArrowRightStartOnRectangleIcon}
      />
    );
  } else if (dialog?.kind === "delete" && me) {
    content = (
      <ConfirmDialog
        open
        onClose={close}
        onConfirm={remove}
        title={lifecycleCopy.deleteTitle}
        text={lifecycleCopy.deleteText(members.map((member) => member.displayName))}
        confirmLabel={
          <>
            <span className="lg:hidden">{lifecycleCopy.deleteConfirmPhone}</span>
            <span className="hidden lg:inline">{lifecycleCopy.deleteConfirmDesktop}</span>
          </>
        }
        icon={ExclamationTriangleIcon}
        confirmText={name}
      />
    );
  } else if (dialog?.kind === "handOver" && me) {
    const member = dialog.member;
    content = (
      <ConfirmDialog
        open
        onClose={close}
        onConfirm={() =>
          run(
            () => handOverHousehold(household, me.uid, member),
            lifecycleCopy.handedOver(member.displayName, name),
          )
        }
        title={lifecycleCopy.handOverTitle(member.displayName)}
        text={lifecycleCopy.handOverText(member.displayName)}
        confirmLabel={lifecycleCopy.handOverConfirm}
        loadingLabel={lifecycleCopy.handingOver}
        icon={ArrowsRightLeftIcon}
        tone="brand"
      />
    );
  } else if (dialog?.kind === "remove" && me) {
    const member = dialog.member;
    content = (
      <ConfirmDialog
        open
        onClose={close}
        onConfirm={() =>
          run(
            () => removeMember(household, me.uid, member, tasks),
            lifecycleCopy.removed(member.displayName),
          )
        }
        title={lifecycleCopy.removeTitle(member.displayName)}
        text={lifecycleCopy.removeText(member.displayName, name)}
        confirmLabel={lifecycleCopy.removeConfirm}
        loadingLabel={lifecycleCopy.removing}
        icon={UserMinusIcon}
      />
    );
  }

  return {
    leaveState,
    canAct,
    interrupted: isOwner && household.deleting === true,
    openLeave: () => setDialog({ kind: "leave" }),
    openDelete: () => setDialog({ kind: "delete" }),
    openHandOver: (member) => setDialog({ kind: "handOver", member }),
    openRemove: (member) => setDialog({ kind: "remove", member }),
    resumeDelete: () => {
      if (resuming.current) return;
      resuming.current = true;
      void remove().finally(() => {
        resuming.current = false;
      });
    },
    dialogs: content,
  };
}
