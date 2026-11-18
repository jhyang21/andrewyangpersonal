import type { Metadata } from "next";
import { Suspense } from "react";
import { StagesPreview } from "./StagesPreview";

export const metadata: Metadata = {
  title: "Stages",
  description: "The Options and Compare stages on the seed decision, in each state, for review.",
};

type Params = Awaited<PageProps<"/projects/pica/kit/stages">["searchParams"]>;
const one = (value: Params[string]) => (typeof value === "string" ? value : undefined);

// The seed and its states load the session store, which runs only in the
// browser, so the server passes the URL's words through as they are.
async function StagesFromUrl({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return <StagesPreview stage={one(params.stage)} state={one(params.state)} />;
}

export default function StagesPage({ searchParams }: PageProps<"/projects/pica/kit/stages">) {
  return (
    <Suspense fallback={null}>
      <StagesFromUrl searchParams={searchParams} />
    </Suspense>
  );
}
