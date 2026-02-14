import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Relora privacy policy summary.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteNav current="home" />
      <main className="mx-auto max-w-3xl px-6 py-12 text-[var(--color-ink)] md:px-10">
        <h1 className="font-serif text-4xl">Privacy</h1>
        <p className="mt-4 text-[var(--color-muted)]">
          Relora is private by default. We only collect what is needed to run the waitlist and
          communicate updates. You can request deletion of your waitlist data at any time.
        </p>
      </main>
    </div>
  );
}
