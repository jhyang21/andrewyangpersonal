import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HOME } from "./home-model";
import { HomeView, type HomeViewProps } from "./HomeScreen";
import { SetupCard } from "./SetupCard";
import { SETUP } from "./setup-model";

const noop = () => {};

function render(props: Partial<HomeViewProps> = {}) {
  return renderToStaticMarkup(
    <HomeView text="" onTextChange={noop} onSend={noop} onExample={noop} busy={false} resume={null} {...props} />,
  );
}

const card = { title: "A commute backpack", facts: "3 needs · 4 options", href: "/projects/pica/d/a", others: 0 };

describe("HomeView", () => {
  it("asks one question in the page's only h1", () => {
    const out = render();
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain(`>${HOME.heading}</h1>`);
  });

  it("labels the goal box with words that answer the heading", () => {
    expect(render()).toContain(HOME.boxLabel);
    expect(render()).toContain(`placeholder="${HOME.placeholder}"`);
    expect(render()).not.toContain("what you&#x27;re trying to do");
  });

  it("shows Pica idle at 120 with an empty box, listening once there is text", () => {
    expect(render()).toMatch(/<svg[^>]*width="120"[^>]*data-pose="idle"|data-pose="idle"[^>]*width="120"/);
    expect(render({ text: "A bag" })).toContain('data-pose="listening"');
  });

  it("has one purple thing, the send button", () => {
    const out = render({ text: "A bag", resume: card });
    // A purple fill at rest; hover states and the pressed shade do not count.
    expect(out.match(/(?<![:\w-])bg-shop-purple(?![\w-])/g)).toHaveLength(1);
  });

  it("offers the examples as chips, the scope line and the category links", () => {
    const out = render();
    expect(out).toContain('aria-label="Examples"');
    expect(out).toContain(">My shoulder no longer aches after the commute<");
    expect(out).toContain(HOME.scope);
    for (const category of ["bag", "backpack", "luggage"]) expect(out).toContain(`href="/projects/pica/browse?category=${category}"`);
  });

  it("shows no card to pick up when nothing is open", () => {
    expect(render()).not.toContain(HOME.resumeHeading);
  });

  it("puts the card to pick up under the scope line and above the category links, with the title, the facts and Resume", () => {
    const out = render({ resume: card });
    expect(out).toContain(`>${HOME.resumeHeading}</h2>`);
    expect(out).toContain("3 needs · 4 options");
    expect(out).toMatch(/href="\/projects\/pica\/d\/a"[^>]*>[\s\S]*?Resume[\s\S]*?: A commute backpack/);
    expect(out.indexOf(HOME.scope)).toBeLessThan(out.indexOf(HOME.resumeHeading));
    expect(out.indexOf(HOME.resumeHeading)).toBeLessThan(out.indexOf(HOME.browse));
    expect(out).not.toContain('href="/projects/pica/saved"');
  });

  it("keeps everything above the scope line the same when the card arrives", () => {
    const top = (html: string) => html.slice(0, html.indexOf(HOME.scope));
    expect(top(render({ resume: card }))).toBe(top(render()));
  });

  it("spaces wrapped chip rows so their 44px hit areas do not overlap", () => {
    expect(render()).toMatch(/aria-label="Examples" class="[^"]*gap-y-4/);
  });

  it("links to Saved when more decisions are open", () => {
    expect(render({ resume: { ...card, others: 2 } })).toContain('href="/projects/pica/saved"');
  });

  it("holds the chips and shows the box busy while a decision opens", () => {
    const out = render({ busy: true });
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?My shoulder no longer aches after the commute/);
    expect(out).toContain(HOME.starting);
  });

  it("never names the old product", () => {
    expect(render({ resume: card })).not.toContain("Shop Companion");
  });

  it("puts the first-run choice in place of the goal box and chips, keeping the heading and links", () => {
    const out = render({ setup: <SetupCard onKey={async () => null} onDemo={noop} /> });
    expect(out).toContain(`>${HOME.heading}</h1>`);
    expect(out).toContain(SETUP.keyLabel);
    expect(out).toContain(SETUP.demoLabel);
    expect(out).not.toContain(HOME.boxLabel);
    expect(out).not.toContain('aria-label="Examples"');
    expect(out).toContain('href="/projects/pica/browse?category=bag"');
  });

  it("shows the foot line it is given", () => {
    expect(render({ footer: <p>{SETUP.change}</p> })).toContain(SETUP.change);
  });
});

describe("SetupCard", () => {
  const out = renderToStaticMarkup(<SetupCard onKey={async () => null} onDemo={noop} />);

  it("starts on the key, in a hidden field the browser won't fill or save", () => {
    expect(out).toMatch(/<input[^>]*type="radio"[^>]*checked=""[^>]*value="key"/);
    expect(out).toMatch(/<input[^>]*type="password"/);
    expect(out).toMatch(/<input[^>]*type="password"[^>]*autoComplete="off"|autoComplete="off"[^>]*type="password"/i);
    expect(out).toContain(SETUP.keyField);
    expect(out).toContain(SETUP.keyHint.replace(/'/g, "&#x27;"));
  });

  it("offers the demo and one Next, the only purple button", () => {
    expect(out).toContain(SETUP.demoHint);
    expect(out).toContain(`>${SETUP.next}<`);
    expect(out.match(/(?<![:\w-])bg-shop-purple(?![\w-])/g)).toHaveLength(1);
  });

  it("offers to forget or keep a pasted key only when one is kept", () => {
    expect(out).not.toContain(SETUP.forget);
    const kept = renderToStaticMarkup(
      <SetupCard onKey={async () => null} onDemo={noop} hasKey onForget={noop} onKeep={noop} />,
    );
    expect(kept).toContain(SETUP.forget);
    expect(kept).toContain(SETUP.keep);
  });

  it("offers Keep without Forget when no forget handler is given", () => {
    const kept = renderToStaticMarkup(<SetupCard onKey={async () => null} onDemo={noop} hasKey onKeep={noop} />);
    expect(kept).not.toContain(SETUP.forget);
    expect(kept).toContain(SETUP.keep);
  });

  it("always offers the key option beside the demo, with no demo-only mode", () => {
    for (const markup of [
      out,
      renderToStaticMarkup(<SetupCard onKey={async () => null} onDemo={noop} hasKey onForget={noop} onKeep={noop} />),
    ]) {
      expect(markup).toContain(SETUP.keyLabel);
      expect(markup).toContain(SETUP.demoLabel);
      expect(markup).toContain(SETUP.line);
      expect(markup).toMatch(/<input[^>]*type="radio"[^>]*value="key"/);
    }
  });
});
