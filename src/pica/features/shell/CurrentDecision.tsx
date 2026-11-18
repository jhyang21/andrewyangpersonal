"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/pica/lib/session";
import { endWithoutBuying, saveForLater } from "@/pica/features/decision/actions";
import { DecisionMenu } from "@/pica/features/parts/DecisionMenu";
import { doneHref } from "@/pica/features/shared/journey";
import { decisionInPath, menuPlace } from "./header-model";
import { MenuSlot } from "./HeaderView";

/**
 * "Save for later" and "End without buying", in the workspace, at every
 * width. Inside any decision it holds the menu's place, filled or not, so
 * the bar does not shift when the store loads. Reading the path suspends
 * while a dynamic route renders, so it sits inside <Suspense> in AppHeader.
 */
export function CurrentDecisionMenu() {
  const router = useRouter();
  const where = decisionInPath(usePathname());
  const { ready, session } = useSession(where?.id ?? "");
  if (!where) return null;
  const place = menuPlace(where.place);
  if (!ready || !session || !place) return <MenuSlot />;
  const id = session.id;

  return (
    <MenuSlot>
      <DecisionMenu
        session={session}
        onSave={() => {
          saveForLater(id, place);
          router.push(doneHref(id));
        }}
        onEnd={() => {
          endWithoutBuying(id, place);
          router.push(doneHref(id));
        }}
      />
    </MenuSlot>
  );
}
