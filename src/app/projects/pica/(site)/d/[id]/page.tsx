import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceLoading, WorkspaceScreen } from "@/pica/features/workspace/Workspace";

export const metadata: Metadata = { title: "Your decision · Pica" };

export default function DecisionPage({ params }: PageProps<"/projects/pica/d/[id]">) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <WorkspaceScreen params={params} />
    </Suspense>
  );
}
