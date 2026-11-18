import { Suspense } from "react";
import { CurrentDecisionMenu } from "./CurrentDecision";
import { HeaderView, MenuSlot } from "./HeaderView";

/**
 * The bar across every page. It learns whether it is inside a decision from
 * the address (`/d/{id}`, `/d/{id}/decide`, `/d/{id}/done`) and the session
 * store, so no screen passes it anything. The menu reads the path, which
 * waits on dynamic routes, so it sits in <Suspense>. The decision routes are
 * the only dynamic ones here, so the fallback holds the menu's place: the
 * bar keeps its shape from the first HTML.
 */
export function AppHeader() {
  return (
    <HeaderView
      menu={
        <Suspense fallback={<MenuSlot />}>
          <CurrentDecisionMenu />
        </Suspense>
      }
    />
  );
}
