import { ShiftMachine } from "@/components/final-shift/ShiftMachine";

/*
 * Nothing here is cacheable: once the session cookie exists, every render depends on it.
 *
 * From Phase 5 this component reads that cookie and loads the guest, their draft, and the event
 * config on the server, then hands the result to <ShiftMachine> as initialSession — so a returning
 * guest on a cold mobile connection never sees the keypad flash before being recognised. Until the
 * backend exists there is nothing to read, so it passes null and the flow starts at the timeclock.
 */
export const dynamic = "force-dynamic";

export default function FinalShiftPage() {
  return <ShiftMachine initialSession={null} />;
}
