"use client";

import { BASE } from "@/pica/lib/base";
import { useRouter } from "next/navigation";
import { use } from "react";
import { Skeleton } from "@/pica/components/kit";
import { useSession } from "@/pica/lib/session";
import type { DecisionSession } from "@/pica/lib/types";
import { DemoStop } from "@/pica/features/demo/DemoStop";
import { ErrorState, ReturnCheck } from "@/pica/features/parts";
import { doneHref } from "@/pica/features/shared/journey";
import { decideTarget } from "./decide-screen-model";
import { DecideView, NoOptionView } from "./DecideView";
import { endWithNothingChosen, saveWithNothingChosen } from "./no-option-actions";
import { useDecide } from "./useDecide";

interface DecideScreenProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ product?: string | string[] }>;
}

export function DecideScreen({ params, searchParams }: DecideScreenProps) {
  const { id } = use(params);
  const query = use(searchParams);
  const asked = typeof query.product === "string" ? query.product : undefined;
  const { ready, session } = useSession(id);

  if (!ready) {
    return (
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-3 px-4 pt-3" aria-busy="true">
        <h1 className="sr-only">Decide</h1>
        <Skeleton className="h-11 rounded-pill" />
        <Skeleton className="h-64 rounded-card" />
      </main>
    );
  }
  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 py-8">
        <h1 className="sr-only">Decide</h1>
        <ErrorState
          code="session_not_found"
          where="decide"
          title="This decision isn't saved in this browser"
          description="Decisions stay in the browser where you started them."
          action={{ label: "Start a new one", href: BASE }}
        />
      </main>
    );
  }
  // The demo's products are made up: no catalog or checkout calls.
  if (session.demo) return <DemoStop sessionId={session.id} />;
  const productId = decideTarget(session, asked);
  if (!productId) return <NoOption session={session} />;
  return <Decide key={`${id}:${productId}`} session={session} productId={productId} />;
}

/** Save and End here pass on what the decision already holds. */
function NoOption({ session }: { session: DecisionSession }) {
  const router = useRouter();
  return (
    <NoOptionView
      session={session}
      returnCheck={<ReturnCheck session={session} />}
      onSave={() => {
        saveWithNothingChosen(session);
        router.push(doneHref(session.id));
      }}
      onEnd={() => {
        endWithNothingChosen(session);
        router.push(doneHref(session.id));
      }}
    />
  );
}

function Decide({ session, productId }: { session: DecisionSession; productId: string }) {
  const decide = useDecide(session, productId);
  return (
    <DecideView
      session={session}
      productId={productId}
      decide={decide}
      returnCheck={<ReturnCheck session={session} />}
    />
  );
}
