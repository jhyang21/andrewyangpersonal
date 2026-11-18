import type { Metadata } from "next";
import { KitPreview } from "./KitPreview";

export const metadata: Metadata = {
  title: "Kit",
  description: "The parts the Pica pages are built from, in every state, for review.",
};

export default function KitPage() {
  return <KitPreview />;
}
