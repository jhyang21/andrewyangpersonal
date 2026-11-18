import { BASE } from "@/pica/lib/base";
import Link from "next/link";
import type { ReactNode } from "react";
import { Pica } from "@/pica/components/mascot";

// Tighter on phones so the bar fits 320px with the menu; 44px high always.
const NAV_LINK =
  "inline-flex min-h-11 items-center rounded-pill px-2 text-body font-medium text-ink hover:bg-surface sm:px-3";

/**
 * The menu's place inside a decision: 44px wide whether the menu shows or
 * not, so Browse and Saved stay put when it arrives with the store.
 */
export function MenuSlot({ children }: { children?: ReactNode }) {
  return <div className="flex w-11 shrink-0 justify-end">{children}</div>;
}

export interface HeaderViewProps {
  /** The decision menu in its `MenuSlot`, such as AppHeader's. Leave out outside a decision. */
  menu?: ReactNode;
}

/**
 * The bar across every page, one 64px row with no data of its own: "Pica"
 * and the mark at 32, linking home; Browse and Saved; and, inside a
 * decision, its menu. The decision's title lives in the page's own heading,
 * not here. AppHeader fills the menu; the parts page passes it by hand.
 * At large text on a narrow screen the links and menu wrap to a second row,
 * still on the right, so the page never scrolls sideways.
 */
export function HeaderView({ menu }: HeaderViewProps) {
  return (
    <header className="w-full">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center px-4">
        <Link
          href={BASE}
          className="inline-flex min-h-11 items-center gap-2 rounded-pill pr-2 text-body-lg font-semibold text-ink"
        >
          <Pica size={32} />
          <span>Pica</span>
        </Link>
        {/* The links and the menu move together, so a wrap keeps them on the right. */}
        <div className="ml-auto flex flex-wrap items-center justify-end">
          <nav aria-label="Main" className="flex items-center">
            <Link href={`${BASE}/browse`} className={NAV_LINK}>
              Browse
            </Link>
            <Link href={`${BASE}/saved`} className={NAV_LINK}>
              Saved
            </Link>
          </nav>
          {menu}
        </div>
      </div>
    </header>
  );
}
