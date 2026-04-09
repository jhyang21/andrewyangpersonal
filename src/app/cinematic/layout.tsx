import type { Metadata } from "next";
import { CinematicBody } from "@/components/cinematic/CinematicBody";
import { LenisProvider } from "@/components/cinematic/LenisProvider";
import { ReducedMotionProvider } from "@/components/cinematic/ReducedMotionProvider";
import { CinematicNav } from "@/components/cinematic/CinematicNav";

export const metadata: Metadata = {
  title: "Cinematic | Andrew Yang",
  description: "An immersive exploration of evolving ideas.",
};

export default function CinematicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CinematicBody>
      <ReducedMotionProvider>
        <LenisProvider>
          <CinematicNav />
          <main className="min-h-screen pt-20">
            {children}
          </main>
        </LenisProvider>
      </ReducedMotionProvider>
    </CinematicBody>
  );
}
