import type { AdminGuest, AdminPayload } from "@/lib/final-shift/admin";
import { tallyDates } from "@/lib/final-shift/admin";
import { COPY } from "@/lib/final-shift/copy";

/**
 * Read-only, and a server component — no state, no fetching, no client bundle.
 *
 * The whole screen is one server render behind the admin cookie, which is also why the signed photo
 * URLs are safe to put straight in the markup: they are minted in the same request that checked the
 * cookie and they expire on their own.
 */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="fs-section text-[var(--fs-cream)]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="fs-body text-[var(--fs-oat)]">{children}</p>;
}

/** Attendance in words as well as colour — this page gets read at a glance and misread in a hurry. */
function statusLine(guest: AdminGuest): string {
  if (guest.status === null) return COPY.admin.noClockIn;
  if (guest.status === "draft") return COPY.admin.started;
  if (guest.attending === true) return "Clocking in";
  if (guest.attending === false) return "Can't make it";
  return COPY.admin.started;
}

function dateLabels(guest: AdminGuest, payload: AdminPayload): string {
  const labels = payload.event.dateOptions
    .filter((option) => guest.availableDates.includes(option.id))
    .map((option) => option.label);
  return labels.length > 0 ? labels.join(", ") : "—";
}

export function AdminDashboard({ payload }: { payload: AdminPayload }) {
  const tally = tallyDates(payload);
  const withFood = payload.guests.filter(
    (guest) => guest.dietaryTags.length > 0 || guest.dietaryNote !== "",
  );
  const withPhotos = payload.guests.filter((guest) => guest.photoUrl !== null);
  const gaps = payload.guests.filter(
    (guest) => !guest.hasPrivateNote || guest.status !== "submitted",
  );

  return (
    <main className="fs-stage fs-stage-wide">
      <div>
        <header>
          <p className="fs-label text-[var(--fs-muted-on-espresso)]">
            {payload.event.eventName}
          </p>
          <h1 className="fs-title mt-2 text-[var(--fs-cream)]">
            {COPY.admin.heading}
          </h1>
        </header>

        {/* The one thing Andrew actually has to decide. It goes first. */}
        <Section title={COPY.admin.dates}>
          {tally.length === 0 ? (
            <Muted>{COPY.admin.datesEmpty}</Muted>
          ) : (
            <ol className="list-none space-y-2 p-0">
              {tally.map(({ option, names }) => (
                <li
                  key={option.id}
                  className="rounded-[var(--fs-radius)] border border-[var(--fs-line)] p-3"
                >
                  <p className="fs-meta text-[var(--fs-cream)]">
                    {option.label}
                    {option.sublabel ? ` · ${option.sublabel}` : ""}
                  </p>
                  <p className="fs-label mt-1 text-[var(--fs-oat)]">
                    {COPY.admin.votes(names.length)}
                    {names.length > 0 ? ` — ${names.join(", ")}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title={COPY.admin.coverage}>
          {gaps.length === 0 ? (
            <Muted>{COPY.admin.coverageClear}</Muted>
          ) : (
            <ul className="list-none space-y-2 p-0">
              {gaps.map((guest) => (
                <li key={guest.guestId} className="fs-body text-[var(--fs-oat)]">
                  <span className="text-[var(--fs-cream)]">{guest.firstName}</span>
                  {" — "}
                  {[
                    guest.status !== "submitted" ? statusLine(guest) : null,
                    guest.hasPrivateNote ? null : COPY.admin.noNote,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={COPY.admin.responses}>
          {/* Cards, not a table: eight rows of ten columns is a horizontal scrollbar on any laptop. */}
          <ul className="list-none space-y-3 p-0">
            {payload.guests.map((guest) => (
              <li
                key={guest.guestId}
                className="rounded-[var(--fs-radius)] border border-[var(--fs-line)] p-4"
              >
                <p className="fs-meta text-[var(--fs-cream)]">
                  {guest.firstName}
                  <span className="fs-label ml-2 text-[var(--fs-muted-on-espresso)]">
                    {guest.crewRole}
                  </span>
                </p>
                <p className="fs-label mt-2 text-[var(--fs-oat)]">
                  {statusLine(guest)}
                </p>

                <dl className="mt-3 space-y-1">
                  <div className="flex gap-2">
                    <dt className="fs-label text-[var(--fs-muted-on-espresso)]">
                      Dates
                    </dt>
                    <dd className="fs-body text-[var(--fs-oat)]">
                      {dateLabels(guest, payload)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="fs-label text-[var(--fs-muted-on-espresso)]">
                      Food
                    </dt>
                    <dd className="fs-body text-[var(--fs-oat)]">
                      {[guest.dietaryTags.join(", "), guest.dietaryNote]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="fs-label text-[var(--fs-muted-on-espresso)]">
                      Wall
                    </dt>
                    <dd className="fs-body text-[var(--fs-oat)]">
                      {guest.wallConsent
                        ? COPY.admin.consentYes
                        : COPY.admin.consentNo}
                    </dd>
                  </div>
                </dl>

                {guest.memory ? (
                  <p className="fs-body mt-3 border-l-2 border-[var(--fs-line)] pl-3 text-[var(--fs-cream)]">
                    {guest.memory}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={COPY.admin.dietary}>
          {withFood.length === 0 ? (
            <Muted>{COPY.admin.dietaryEmpty}</Muted>
          ) : (
            <ul className="list-none space-y-2 p-0">
              {withFood.map((guest) => (
                <li key={guest.guestId} className="fs-body text-[var(--fs-oat)]">
                  <span className="text-[var(--fs-cream)]">{guest.firstName}</span>
                  {" — "}
                  {[guest.dietaryTags.join(", "), guest.dietaryNote]
                    .filter(Boolean)
                    .join(" · ")}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={COPY.admin.photos}>
          {withPhotos.length === 0 ? (
            <Muted>{COPY.admin.photosEmpty}</Muted>
          ) : (
            <ul className="grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3">
              {withPhotos.map((guest) => (
                <li key={guest.guestId}>
                  <div className="bg-[#fffdf8] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- expiring signed URL */}
                    <img
                      src={guest.photoUrl ?? ""}
                      alt={`${guest.firstName}'s shift photo`}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/5] w-full bg-[var(--fs-ink)] object-cover"
                    />
                  </div>
                  <p className="fs-label mt-2 text-[var(--fs-cream)]">
                    {guest.firstName}
                  </p>
                  {/*
                   * The consent state is on every photo, including the ones that are not on the wall.
                   * Andrew sees all of them here because he needs to — but a photo taken by someone
                   * who declined the wall must never be printed, projected, or posted, and the only
                   * thing standing between him and that mistake is this line.
                   */}
                  <p className="fs-label text-[var(--fs-oat)]">
                    {guest.wallConsent
                      ? COPY.admin.consentYes
                      : COPY.admin.consentNo}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </main>
  );
}
