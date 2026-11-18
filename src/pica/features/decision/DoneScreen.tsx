"use client";

import { BASE } from "@/pica/lib/base";
import { use } from "react";
import { Skeleton } from "@/pica/components/kit";
import { useSession } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { ErrorState, ReturnCheck } from "@/pica/features/parts";
import { DoneView } from "./DoneView";
import { useDone } from "./useDone";

export function DoneScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready, session } = useSession(id);

  if (!ready) {
    return (
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4 px-4 pt-3" aria-busy="true">
        <h1 className="sr-only">Your decision</h1>
        <Skeleton className="h-11 rounded-pill" />
        <Skeleton className="h-64 rounded-card" />
      </main>
    );
  }
  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 py-8">
        <h1 className="sr-only">Your decision</h1>
        <ErrorState
          code="session_not_found"
          where="done"
          title="This decision isn't saved in this browser"
          description="Decisions stay in the browser where you started them."
          action={{ label: "Start a new one", href: BASE }}
        />
      </main>
    );
  }
  return <Done session={session} />;
}

function Done({ session }: { session: DecisionSession }) {
  const done = useDone(session);
  return <DoneView session={session} done={done} returnCheck={<ReturnCheck session={session} goToDone={false} />} />;
}
