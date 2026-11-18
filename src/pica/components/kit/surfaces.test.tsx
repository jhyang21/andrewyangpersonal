import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Sheet, trapTarget } from "./Sheet";
import { Skeleton, SkeletonCard } from "./Skeleton";

const noop = () => undefined;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const art = <span data-art="mascot" />;

describe("Card", () => {
  it("takes aria-labelledby, to be named by its heading", () => {
    const out = html(
      <Card as="article" aria-labelledby="q-1">
        <h3 id="q-1">How do you get to work?</h3>
      </Card>,
    );
    expect(out).toMatch(/^<article aria-labelledby="q-1" class="rounded-card/);
    expect(html(<Card>Body</Card>)).not.toContain("aria-labelledby");
  });

  it("is white with the card radius and the chosen tag", () => {
    const out = html(<Card as="article">Body</Card>);
    expect(out).toMatch(/^<article class="rounded-card bg-surface p-4">Body<\/article>$/);
    expect(html(<Card padding="none" shadow>x</Card>)).toContain("shadow-card");
  });
});

describe("Sheet", () => {
  it("is a native dialog named by its title; closed, it renders no content", () => {
    const out = html(
      <Sheet open={false} onClose={noop} title="Where this comes from">
        Body
      </Sheet>,
    );
    expect(out).toMatch(/^<dialog aria-modal="true" aria-labelledby="[^"]+"/);
    expect(out).not.toContain("Body");
    expect(out).not.toContain("aria-describedby");
  });

  it("puts its id on the dialog, which stays mounted while closed, so aria-controls always finds it", () => {
    for (const open of [false, true]) {
      const out = html(
        <Sheet id="canvas-sheet" open={open} onClose={noop} title="Your needs">
          Body
        </Sheet>,
      );
      expect(out).toMatch(/^<dialog id="canvas-sheet" /);
    }
  });

  it("moves on a 200ms token curve from the bottom on phones", () => {
    const out = html(<Sheet open={false} onClose={noop} title="t">x</Sheet>);
    expect(out).toContain("duration-(--duration-base)");
    expect(out).toContain("ease-out-soft");
    expect(out).toContain("starting:translate-y-full");
  });

  it("keeps Tab inside: wraps at the ends, else lets the browser move", () => {
    const items = ["close", "link", "button"];
    expect(trapTarget(items, "button", false)).toBe("close");
    expect(trapTarget(items, "close", true)).toBe("button");
    expect(trapTarget(items, "link", false)).toBeNull();
    expect(trapTarget(items, "link", true)).toBeNull();
    expect(trapTarget([], null, false)).toBeNull();
    expect(trapTarget(["only"], "only", false)).toBe("only");
  });
});

describe("Banner", () => {
  it("critical is an alert; info and caution are status lines", () => {
    expect(html(<Banner tone="critical">x</Banner>)).toMatch(/^<div role="alert"/);
    expect(html(<Banner tone="caution">x</Banner>)).toMatch(/^<div role="status"/);
    expect(html(<Banner>x</Banner>)).toMatch(/^<div role="status"/);
  });

  it("the role is on the banner, never on its action", () => {
    const out = html(
      <Banner tone="critical" action={{ label: "Try again", onClick: noop }}>
        Pica can&apos;t reply right now.
      </Banner>,
    );
    expect(out.match(/role="/g)).toHaveLength(1);
    expect(out).toMatch(/<button type="button"[^>]*><span[^>]*>Try again<\/span><\/button>/);
  });

  it("its action can load, keeping focus, or be off", () => {
    const button = (out: string) => out.match(/<button[^>]*>/)?.[0] ?? "";
    const loading = button(html(<Banner action={{ label: "Update", onClick: noop, loading: true }}>x</Banner>));
    expect(loading).toContain('aria-busy="true"');
    expect(loading).not.toMatch(/\sdisabled=/);
    const off = button(html(<Banner action={{ label: "Update", onClick: noop, disabled: true }}>x</Banner>));
    expect(off).toMatch(/\sdisabled=""/);
    expect(off).not.toContain("aria-busy");
    const held = button(html(<Banner action={{ label: "Update", onClick: noop, held: true }}>x</Banner>));
    expect(held).toContain('aria-disabled="true"');
    expect(held).not.toMatch(/\sdisabled=/);
    expect(held).not.toContain("aria-busy");
  });

  it("each tone has its own icon and a hidden word", () => {
    expect(html(<Banner>x</Banner>)).toContain("lucide-info");
    expect(html(<Banner tone="caution">x</Banner>)).toContain("lucide-triangle-exclamation-point");
    const critical = html(<Banner tone="critical" title="Checkout didn't start">x</Banner>);
    expect(critical).toContain("lucide-octagon-exclamation-point");
    expect(critical).toContain('<span class="sr-only">Problem: </span>');
  });

  it("caution sits on caution-bg with ink text", () => {
    const out = html(<Banner tone="caution">x</Banner>);
    const cls = out.match(/class="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(cls).toEqual(expect.arrayContaining(["bg-caution-bg", "text-ink"]));
    expect(out).not.toContain("text-ink-muted");
    expect(out).not.toContain("text-ink-soft");
  });

  it("every tone has a 1px ink-muted edge, so it holds on a white card or in a Sheet", () => {
    for (const tone of ["info", "caution", "critical"] as const) {
      const cls = html(<Banner tone={tone}>x</Banner>).match(/class="([^"]*)"/)?.[1].split(" ") ?? [];
      expect(cls).toEqual(expect.arrayContaining(["border", "border-ink-muted"]));
    }
  });

  it("art takes the lead spot and the tone icon still shows", () => {
    const out = html(
      <Banner tone="critical" art={art}>
        x
      </Banner>,
    );
    expect(out).toContain('<span aria-hidden="true" class="shrink-0"><span data-art="mascot"></span></span>');
    expect(out).toContain("lucide-octagon-exclamation-point");
  });
});

describe("Skeleton", () => {
  it("is hidden from screen readers and pulses only when motion is allowed", () => {
    for (const out of [html(<Skeleton />), html(<Skeleton variant="text" lines={2} />), html(<SkeletonCard />)]) {
      expect(out).toMatch(/^<div aria-hidden="true"/);
      expect(out).toContain("motion-safe:animate-pulse");
      expect(out).not.toMatch(/(^|\s|")animate-pulse/);
    }
  });
  it("text lines: the last one is shorter", () => {
    const out = html(<Skeleton variant="text" lines={3} />);
    expect(out.match(/w-full/g)).toHaveLength(2);
    expect(out.match(/w-3\/5/g)).toHaveLength(1);
  });
});

describe("EmptyState", () => {
  it("shows the art slot hidden, a heading, one ink-soft line and one action", () => {
    const out = html(
      <EmptyState
        art={art}
        title="No options yet"
        description="Tell Pica what you need, or ask for products now."
        action={<Button>Show me products now</Button>}
      />,
    );
    expect(out).toContain('<div aria-hidden="true" class="flex items-center justify-center"><span data-art="mascot">');
    expect(out).toMatch(/<h2 class="[^"]*">No options yet<\/h2>/);
    expect(out).toMatch(/<p class="[^"]*text-ink-soft[^"]*">Tell Pica/);
    expect(out).toContain("Show me products now");
  });
  it("takes an h3 and works with no art", () => {
    const out = html(<EmptyState title="No decisions yet" headingLevel="h3" />);
    expect(out).toContain("<h3");
    expect(out).not.toContain("aria-hidden");
  });
});
