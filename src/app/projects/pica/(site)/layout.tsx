import { AppHeader } from "@/pica/features/shell/AppHeader";

/**
 * Every buyer-facing page: a skip link, the Pica header (which finds the
 * decision on screen by itself) and the page.
 */
export default function SiteLayout({ children }: LayoutProps<"/projects/pica">) {
  return (
    <>
      <a
        href="#content"
        className="sr-only rounded-pill bg-surface px-4 py-3 text-body font-medium text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      <AppHeader />
      <div id="content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        {children}
      </div>
    </>
  );
}
