/*
 * Server-only environment access.
 *
 * The throw guard below is the load-bearing line. Every module that touches a secret — the database
 * client, Storage, the session signer, the code pepper — imports this one, so a stray `import` from
 * a "use client" component fails loudly at module evaluation instead of quietly shipping
 * SUPABASE_SERVICE_ROLE_KEY inside a JavaScript bundle. There is no NEXT_PUBLIC_ variable anywhere
 * in this feature, and there must never be one: that prefix is exactly how a key ends up in the
 * browser.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "final-shift server module imported in the browser. This module reads secrets and must stay on the server.",
  );
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Name the variable. A missing secret at 11pm the night before the party should not need a
    // stack trace to diagnose.
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

export function optionalEnv(name: string): string | null {
  return process.env[name] || null;
}
