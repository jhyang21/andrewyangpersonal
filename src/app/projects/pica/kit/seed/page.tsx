import type { Metadata } from "next";
import { SeedPanel } from "./SeedPanel";

export const metadata: Metadata = {
  title: "Seed",
  description: "Writes one made-up decision into this browser, for building screens.",
};

export default function SeedPage() {
  return <SeedPanel />;
}
