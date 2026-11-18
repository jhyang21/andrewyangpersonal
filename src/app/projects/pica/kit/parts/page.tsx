import type { Metadata } from "next";
import { PartsPreview } from "./PartsPreview";

export const metadata: Metadata = {
  title: "Shared parts",
  description: "The parts Pica's screens share, in every state, on the seed decision, for review.",
};

export default function PartsPage() {
  return <PartsPreview />;
}
