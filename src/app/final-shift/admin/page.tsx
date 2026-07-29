import { AdminDashboard } from "@/components/final-shift/AdminDashboard";
import { AdminLogin } from "@/components/final-shift/AdminLogin";
import { loadAdminPayload } from "@/lib/final-shift/admin";
import { isAdmin } from "@/lib/final-shift/api";

export const dynamic = "force-dynamic";

/**
 * Andrew's screen.
 *
 * Unlisted the same way the rest of the feature is — the layout's noindex metadata and the
 * `X-Robots-Tag` header cover `/final-shift/:path*`, so this route needs nothing of its own.
 *
 * The gate is a server render, not a client redirect: without the cookie the dashboard's data is
 * never fetched, never serialised, and never in the page for someone to read out of the HTML.
 */
export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;

  return <AdminDashboard payload={await loadAdminPayload()} />;
}
