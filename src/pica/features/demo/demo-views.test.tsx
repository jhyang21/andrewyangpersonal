import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { userMessage } from "@/pica/lib/session";
import { DemoBar, demoStepLabel } from "./DemoBar";
import { DEMO, DEMO_STEPS } from "./demo-script";
import { DEMO_STOP, DemoStop } from "./DemoStop";

const noop = () => {};

function bar(messages: ReturnType<typeof userMessage>[], busy = false) {
  return renderToStaticMarkup(<DemoBar messages={messages} busy={busy} send={() => true} go={noop} />);
}

describe("DemoBar", () => {
  it("counts steps from the scripted turns sent", () => {
    expect(demoStepLabel(0)).toBe(`Step 1 of ${DEMO_STEPS.length}`);
    expect(demoStepLabel(DEMO_STEPS.length)).toBe("Done");
  });

  it("says what Next does, and offers a way out", () => {
    const out = bar([]);
    expect(out).toContain(`aria-label="${DEMO.bar}"`);
    expect(out).toContain(DEMO_STEPS[0].caption);
    expect(out).toContain(`>${DEMO.next}<`);
    expect(out).toContain(`>${DEMO.leave}<`);
    expect(out).toContain('href="/projects/pica"');
  });

  it("holds Next while Pica replies", () => {
    expect(bar([userMessage("u", DEMO_STEPS[0].buyer)], true)).toContain('aria-disabled="true"');
  });

  it("drops Next at the end and says where to go for real", () => {
    const out = bar(DEMO_STEPS.map((step, i) => userMessage(`u${i}`, step.buyer)));
    expect(out).not.toContain(`>${DEMO.next}<`);
    expect(out).toContain(DEMO.done.replace("'", "&#x27;"));
  });
});

describe("DemoStop", () => {
  it("stops a demo at Decide with a way back to Compare", () => {
    const out = renderToStaticMarkup(<DemoStop sessionId="d1" />);
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain(DEMO_STOP.title);
    expect(out).toContain('href="/projects/pica/d/d1?view=compare"');
    expect(out).toContain('href="/projects/pica"');
  });
});
