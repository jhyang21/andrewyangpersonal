import { BASE } from "@/pica/lib/base";
import { Button, EmptyState } from "@/pica/components/kit";
import { Pica } from "@/pica/components/mascot";
import { viewHref } from "@/pica/features/workspace/frame-model";

export const DEMO_STOP = {
  heading: "Decide",
  title: "The demo stops before checkout",
  body: "Its products are made up, so there is nothing to buy. Add your OpenAI key on Home to choose and buy for real.",
  back: "Back to Compare",
  home: "Go to Home",
} as const;

/** Decide for a demo decision: no catalog or checkout calls, a way back instead. */
export function DemoStop({ sessionId }: { sessionId: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 py-8">
      <h1 className="sr-only">{DEMO_STOP.heading}</h1>
      <EmptyState
        art={<Pica pose="resting" size={120} />}
        title={DEMO_STOP.title}
        description={DEMO_STOP.body}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" href={viewHref(sessionId, "compare")}>
              {DEMO_STOP.back}
            </Button>
            <Button href={BASE} on="canvas">
              {DEMO_STOP.home}
            </Button>
          </div>
        }
      />
    </main>
  );
}
