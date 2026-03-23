import { getAllCinematicTheses } from "@/lib/cinematic-theses";
import { ThesisWall } from "@/components/cinematic/ThesisWall";

export default function CinematicHomePage() {
  const theses = getAllCinematicTheses();

  return (
    <div className="pb-32">
      <ThesisWall theses={theses} />
    </div>
  );
}
