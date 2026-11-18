import type { Metadata } from "next";
import { SavedScreen } from "@/pica/features/saved/SavedScreen";

export const metadata: Metadata = { title: "Saved decisions · Pica" };

export default function SavedPage() {
  return <SavedScreen />;
}
