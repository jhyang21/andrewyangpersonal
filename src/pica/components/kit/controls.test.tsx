import { Backpack, Heart, Search } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { cn, isExternalHref } from "./cn";
import { IconButton } from "./IconButton";
import {
  afterSend,
  fitHeight,
  IntentInput,
  isSendKey,
  sendOnce,
  setBoth,
  shouldClear,
  type SubmitResult,
} from "./IntentInput";
import { rovingIndex } from "./roving";
import { SegmentedControl } from "./SegmentedControl";
import { TextArea } from "./TextArea";
import { TextInput } from "./TextInput";

const noop = () => undefined;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const classesOf = (markup: string, tag = "") =>
  markup.match(new RegExp(`<${tag}[^>]*class="([^"]*)"`))?.[1].split(" ") ?? [];

describe("cn and isExternalHref", () => {
  it("joins and skips empty parts", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
  it("tells links that leave the app", () => {
    expect(isExternalHref("https://shop.app")).toBe(true);
    expect(isExternalHref("//cdn.example.com")).toBe(true);
    expect(isExternalHref("mailto:a@b.c")).toBe(true);
    expect(isExternalHref("/projects/pica/saved")).toBe(false);
  });
});

describe("Button", () => {
  it("renders a plain button with no status role", () => {
    const out = html(<Button onClick={noop}>Save for later</Button>);
    expect(out).toMatch(/^<button type="button"/);
    expect(out).not.toContain("role=");
  });

  it("primary is purple and at least 48 high; secondary and ghost at least 44", () => {
    expect(classesOf(html(<Button variant="primary">Continue to checkout</Button>))).toEqual(
      expect.arrayContaining(["bg-shop-purple", "min-h-12"]),
    );
    expect(classesOf(html(<Button>Compare</Button>))).toContain("min-h-11");
    expect(classesOf(html(<Button variant="ghost">Skip this question</Button>))).toContain("min-h-11");
  });

  it("an internal link uses an anchor with the path, and has no status role", () => {
    const out = html(<Button href="/projects/pica/saved">Saved</Button>);
    expect(out).toMatch(/^<a [^>]*href="\/projects\/pica\/saved"/);
    expect(out).not.toContain("target=");
    expect(out).not.toContain("role=");
  });

  it("an external link opens in a new tab and says so to screen readers", () => {
    const out = html(<Button href="https://example.com/listing">See it on Example</Button>);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('<span class="sr-only">(opens in a new tab)</span>');
  });

  it("a disabled or loading link has no href, so it cannot be followed", () => {
    for (const out of [
      html(<Button href="/projects/pica/saved" disabled>Saved</Button>),
      html(<Button href="/projects/pica/saved" loading>Saved</Button>),
    ]) {
      expect(out).not.toContain("href=");
      expect(out).toContain('aria-disabled="true"');
      // With no href an <a> has no role, so it says it is a link.
      expect(out).toContain('role="link"');
      expect(out).not.toContain("tabindex");
    }
  });

  it("held: off in look and to a screen reader, clicks ignored, but it keeps focus and shows no spinner", () => {
    const out = html(<Button held type="submit" onClick={noop}>Update comparison</Button>);
    expect(out).toMatch(/^<button type="button"/);
    expect(out).not.toContain('disabled=""');
    expect(out).toContain('aria-disabled="true"');
    expect(out).not.toContain("aria-busy");
    expect(out).not.toContain("animate-spin");
    expect(classesOf(out, "button")).toEqual(expect.arrayContaining(["text-ink-muted", "cursor-not-allowed"]));
    expect(classesOf(out, "button").some((c) => c.includes("hover:"))).toBe(false);
    // The click handler never reaches the element.
    const element = Button({ children: "Update comparison", held: true, onClick: noop }) as React.ReactElement<{
      onClick?: unknown;
    }>;
    expect(element.props.onClick).toBeUndefined();
    const live = Button({ children: "Update comparison", onClick: noop }) as React.ReactElement<{ onClick?: unknown }>;
    expect(live.props.onClick).toBe(noop);
  });

  it("a held link stays in the tab order as a link, with no href", () => {
    const out = html(<Button href="/projects/pica/saved" held>Saved</Button>);
    expect(out).toMatch(/^<a aria-disabled="true" role="link" tabindex="0"/);
    expect(out).not.toContain("href=");
  });

  it("loading keeps focus, sets aria-busy, never submits and shows a spinner", () => {
    const out = html(
      <Button type="submit" loading>
        Continue to checkout
      </Button>,
    );
    expect(out).toMatch(/^<button type="button"/);
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('aria-disabled="true"');
    expect(out).not.toMatch(/ disabled=""/);
    expect(out).toContain("lucide-loader-circle");
  });

  it("a disabled ghost uses the disabled colour; a live ghost turns so inside a disabled fieldset", () => {
    expect(classesOf(html(<Button variant="ghost" disabled>Skip</Button>))).toContain("text-disabled");
    expect(classesOf(html(<Button variant="ghost">Skip</Button>))).toContain("disabled:text-disabled");
  });

  it("any button lets a long label wrap, so large text never pushes the page sideways", () => {
    for (const out of [html(<Button fullWidth>End without buying</Button>), html(<Button>End without buying</Button>)]) {
      expect(classesOf(out)).not.toContain("whitespace-nowrap");
      expect(classesOf(out)).toContain("text-center");
    }
    expect(classesOf(html(<Button>End without buying</Button>))).toContain("max-w-full");
  });

  it("takes a minimum height with padding, so two or three lines fit the shape", () => {
    for (const fullWidth of [true, false]) {
      const md = classesOf(html(<Button fullWidth={fullWidth}>Go to a long merchant name to pay</Button>));
      expect(md).toEqual(expect.arrayContaining(["min-h-11", "py-2.5", "rounded-[1.375rem]"]));
      expect(md).not.toContain("h-11");
      expect(md).not.toContain("rounded-pill");
      const lg = classesOf(html(<Button variant="primary" fullWidth={fullWidth}>Go to a long merchant name to pay</Button>));
      expect(lg).toEqual(expect.arrayContaining(["min-h-12", "py-3", "rounded-[1.5rem]"]));
      expect(lg).not.toContain("h-12");
    }
    expect(classesOf(html(<Button fullWidth>Go</Button>))).toContain("w-full");
  });

  it("size sets one height for every variant; the defaults stay as they were", () => {
    for (const variant of ["primary", "secondary", "ghost"] as const) {
      expect(classesOf(html(<Button variant={variant} size="lg">Go</Button>))).toContain("min-h-12");
      expect(classesOf(html(<Button variant={variant} size="md">Go</Button>))).toContain("min-h-11");
    }
    const onCanvas = classesOf(html(<Button on="canvas" size="lg">Go</Button>));
    expect(onCanvas).toContain("min-h-12");
    expect(onCanvas).not.toContain("min-h-11");
  });

  it("pressed: aria-pressed, purple-soft fill, a check and a 2px ink edge", () => {
    const out = html(
      <Button icon={Heart} pressed onClick={noop}>
        Compare
      </Button>,
    );
    expect(out).toContain('aria-pressed="true"');
    expect(classesOf(out)).toEqual(expect.arrayContaining(["bg-purple-soft", "text-ink", "inset-ring-2", "inset-ring-ink"]));
    expect(out).toContain("lucide-check");
    expect(out).not.toContain("lucide-heart");
  });

  it("not pressed: aria-pressed false and the plain look; a plain button has no aria-pressed", () => {
    const off = html(
      <Button icon={Heart} pressed={false} onClick={noop}>
        Compare
      </Button>,
    );
    expect(off).toContain('aria-pressed="false"');
    expect(classesOf(off)).not.toContain("bg-purple-soft");
    expect(off).toContain("lucide-heart");
    expect(html(<Button>Compare</Button>)).not.toContain("aria-pressed");
  });

  it("a toggle with no icon keeps a check-sized slot while unpressed, so its width holds", () => {
    const slot = /<span aria-hidden="true" data-check-slot="true" class="size-\[20px\] shrink-0"><\/span>/;
    const off = html(<Button pressed={false} onClick={noop}>Compare</Button>);
    const on = html(<Button pressed onClick={noop}>Compare</Button>);
    expect(off).toMatch(slot);
    expect(off).not.toContain("lucide-check");
    // Pressed, the check fills the same 20px place and the slot goes.
    expect(on).not.toMatch(slot);
    expect(on).toMatch(/<svg[^>]*width="20"[^>]*class="lucide lucide-check[^"]*shrink-0/);
    // A toggle with an icon, or a plain button, gets no slot.
    expect(html(<Button icon={Heart} pressed={false} onClick={noop}>Compare</Button>)).not.toMatch(slot);
    expect(html(<Button onClick={noop}>Compare</Button>)).not.toContain("data-check-slot");
  });

  it("passes id and disclosure attributes through, on buttons and links", () => {
    const button = html(
      <Button id="more" aria-expanded={false} aria-controls="more-menu" aria-haspopup="menu" aria-label="More for Canvas tote">
        More
      </Button>,
    );
    for (const attr of ['id="more"', 'aria-expanded="false"', 'aria-controls="more-menu"', 'aria-haspopup="menu"', 'aria-label="More for Canvas tote"']) {
      expect(button).toContain(attr);
    }
    const link = html(
      <Button href="/projects/pica/saved" id="saved-link" aria-label="Saved decisions">
        Saved
      </Button>,
    );
    expect(link).toContain('id="saved-link"');
    expect(link).toContain('aria-label="Saved decisions"');
    // A link is never a toggle.
    expect(html(<Button href="/projects/pica/saved" pressed>Saved</Button>)).not.toContain("aria-pressed");
  });
});

describe("IconButton", () => {
  it("is a 44px round button named by its label", () => {
    const out = html(<IconButton icon={Search} label="Search" />);
    expect(out).toContain('aria-label="Search"');
    expect(classesOf(out)).toContain("size-11");
  });
  it("reports pressed for toggles and fills the icon", () => {
    const out = html(<IconButton icon={Heart} label="Save" pressed />);
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain('fill="currentColor"');
  });
  it("passes id and disclosure attributes through; label stays the accessible name", () => {
    const out = html(
      <IconButton
        icon={Search}
        label="Menu"
        id="header-menu"
        aria-expanded
        aria-controls="header-menu-list"
        aria-haspopup="menu"
      />,
    );
    for (const attr of ['aria-label="Menu"', 'id="header-menu"', 'aria-expanded="true"', 'aria-controls="header-menu-list"', 'aria-haspopup="menu"']) {
      expect(out).toContain(attr);
    }
  });
  it("ghost disabled takes the disabled colour; filled tones keep ink-muted", () => {
    expect(classesOf(html(<IconButton icon={Search} label="Search" disabled />))).toContain("disabled:text-disabled");
    expect(classesOf(html(<IconButton icon={Search} label="Search" tone="surface" disabled />))).toContain(
      "disabled:text-ink-muted",
    );
  });
});

describe("Chip", () => {
  it("unselected toggle: aria-pressed false, white with a 1px ink-muted border, no check", () => {
    const out = html(<Chip label="Office" icon={Backpack} selected={false} onClick={noop} />);
    expect(out).toContain('aria-pressed="false"');
    expect(classesOf(out, "span")).toEqual(expect.arrayContaining(["border", "border-ink-muted", "bg-surface"]));
    expect(out).not.toContain("lucide-check");
    expect(out).toContain("lucide-backpack");
  });

  it("selected toggle: fill plus check icon plus a 2px ink edge (1px border and 1px inset ring)", () => {
    const out = html(<Chip label="Office" icon={Backpack} selected onClick={noop} />);
    expect(out).toContain('aria-pressed="true"');
    expect(classesOf(out, "span")).toEqual(
      expect.arrayContaining(["bg-purple-soft", "border", "border-ink", "inset-ring", "inset-ring-ink"]),
    );
    expect(out).toContain("lucide-check");
    expect(out).not.toContain("lucide-backpack");
  });

  it("one-shot chips are plain buttons with no pressed state", () => {
    const out = html(<Chip label="A work backpack under $200" onClick={noop} />);
    expect(out).toContain("<button");
    expect(out).not.toContain("aria-pressed");
  });

  it("every chip button has a hit area that reaches 44px", () => {
    const out = html(<Chip label="Under $200" onClick={noop} onRemove={noop} />);
    const buttons = [...out.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1].split(" "));
    expect(buttons).toHaveLength(2);
    for (const cls of buttons) {
      expect(cls).toEqual(expect.arrayContaining(["relative", "before:absolute", "before:-inset-y-[7px]"]));
    }
  });

  it("removable chips name their remove button", () => {
    expect(html(<Chip label="Under $200" onRemove={noop} />)).toContain('aria-label="Remove Under $200"');
    expect(html(<Chip label="Under $200" onRemove={noop} removeLabel="Drop the budget" />)).toContain(
      'aria-label="Drop the budget"',
    );
  });

  it("a selected label with no action is heard as selected", () => {
    expect(html(<Chip label="Leather" selected />)).toContain('<span class="sr-only">, selected</span>');
  });

  it("a long label wraps inside the chip; nothing is cut", () => {
    const long = "Fits a 16-inch laptop with room for a charger and a water bottle";
    const out = html(<Chip label={long} onClick={noop} onRemove={noop} />);
    expect(out).toContain(long);
    expect(out).not.toContain("truncate");
    expect(out).not.toMatch(/class="(?:[^"]* )?h-8[ "]/);
    expect(classesOf(out, "span")).toEqual(expect.arrayContaining(["min-h-8", "rounded-[16px]", "items-stretch"]));
    expect(out).toContain('<span class="min-w-0 break-words">');
  });
});

describe("TextInput and TextArea", () => {
  it("have a real label tied to the field", () => {
    const out = html(<TextInput id="budget" label="Budget" placeholder="Up to $200" />);
    expect(out).toContain('<label for="budget"');
    expect(out).toContain('id="budget"');
    const area = html(<TextArea id="note" label="Note" />);
    expect(area).toContain('<label for="note"');
  });

  it("take a 1px ink-muted border and ink-soft placeholder", () => {
    for (const out of [html(<TextInput label="Budget" />), html(<TextArea label="Note" />)]) {
      const cls = classesOf(out, "(?:input|textarea)");
      expect(cls).toEqual(expect.arrayContaining(["border", "border-ink-muted", "placeholder:text-ink-soft"]));
      expect(cls).not.toContain("placeholder:text-disabled");
      expect(cls).not.toContain("border-hairline");
    }
  });

  it("focus is the brief's ring: 2px purple with a 2px offset", () => {
    for (const out of [html(<TextInput label="Budget" />), html(<TextArea label="Note" />)]) {
      const cls = classesOf(out, "(?:input|textarea)");
      expect(cls).toEqual(expect.arrayContaining(["focus:outline-2", "focus:outline-offset-2", "outline-shop-purple"]));
      expect(cls).not.toContain("outline-hidden");
      expect(cls).not.toContain("focus:ring-1");
    }
  });

  it("an error swaps the hint, turns the border red and is announced", () => {
    const out = html(<TextInput id="e" label="Email" hint="For the receipt" error="Add an @" />);
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('aria-describedby="e-error"');
    expect(out).toContain('role="alert"');
    expect(out).not.toContain("e-hint");
    expect(classesOf(out, "input")).toContain("border-critical");
  });

  it("a hint is ink-soft and described", () => {
    const out = html(<TextInput id="h" label="Laptop size" hint="Corner to corner" />);
    expect(out).toContain('aria-describedby="h-hint"');
    expect(out).toMatch(/<p id="h-hint" class="[^"]*text-ink-soft/);
  });
});

describe("IntentInput", () => {
  it("Enter sends; Shift+Enter and IME composition do not", () => {
    expect(isSendKey({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true);
    expect(isSendKey({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false);
    expect(isSendKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
    // Safari ends composition with an Enter that has keyCode 229 and isComposing false.
    expect(isSendKey({ key: "Enter", shiftKey: false, isComposing: false, keyCode: 229 })).toBe(false);
    expect(isSendKey({ key: "a", shiftKey: false, isComposing: false })).toBe(false);
  });

  it("while busy, says so politely, keeps the button's name and lets the buyer type", () => {
    const out = html(<IntentInput onSubmit={noop} busy defaultValue="Is luggage worth it?" />);
    expect(out).toMatch(/<span role="status" class="sr-only">Pica is replying<\/span>/);
    expect(out).toMatch(/<button type="submit" aria-label="Ask Pica" disabled=""/);
    expect(out).not.toContain("aria-busy");
    expect(out).not.toMatch(/<textarea[^>]* disabled=""/);
    expect(out).toContain(">Is luggage worth it?</textarea>");
  });

  it("has a real label, an ink-muted edge and an ink-soft placeholder", () => {
    const out = html(<IntentInput onSubmit={noop} label="Ask Pica about these options" />);
    expect(out).toMatch(/<label for="[^"]+" class="sr-only">Ask Pica about these options<\/label>/);
    expect(classesOf(out, "form")).toContain("border-ink-muted");
    expect(classesOf(out, "textarea")).toContain("placeholder:text-ink-soft");
  });

  it("shows a field error under the box and keeps the text", () => {
    const out = html(
      <IntentInput onSubmit={noop} value="A long message" onValueChange={noop} error="That message is too long." />,
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain("That message is too long.");
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain(">A long message</textarea>");
  });

  it("disabled turns the text box off", () => {
    expect(html(<IntentInput onSubmit={noop} disabled />)).toMatch(/<textarea[^>]* disabled=""/);
  });

  it("empty, the box is one line tall, however long its placeholder; text grows it to its cap", () => {
    // Chrome counts a wrapped placeholder in scrollHeight; an empty box ignores it.
    expect(fitHeight("", 132)).toBe("");
    expect(fitHeight("A bag", 44)).toBe("44px");
    expect(fitHeight("A long message", 120)).toBe("120px");
    expect(fitHeight("A very long message", 640)).toBe("200px");
    expect(html(<IntentInput onSubmit={noop} />)).toMatch(/<textarea[^>]* rows="1"/);
  });

  it("inputRef reaches the text field, as an object or a function", () => {
    const field = { id: "field" };
    const own = { current: null as typeof field | null };
    const theirs = { current: null as typeof field | null };
    setBoth(own, theirs, field);
    expect(own.current).toBe(field);
    expect(theirs.current).toBe(field);
    let called: typeof field | null = null;
    setBoth(own, (el: typeof field | null) => void (called = el), field);
    expect(called).toBe(field);
    setBoth(own, undefined, null);
    expect(own.current).toBeNull();
  });

  it("focus draws the brief's 2px ring with a 2px offset round the box", () => {
    const cls = classesOf(html(<IntentInput onSubmit={noop} />), "form");
    expect(cls).toEqual(
      expect.arrayContaining([
        "has-[textarea:focus]:outline-2",
        "has-[textarea:focus]:outline-offset-2",
        "outline-shop-purple",
      ]),
    );
    expect(cls).not.toContain("focus-within:ring-1");
  });
});

describe("IntentInput after a send", () => {
  function run(result: Parameters<typeof afterSend>[0], current = "A bag for a wedding") {
    let cleared = 0;
    const pending = afterSend(result, "A bag for a wedding", () => current, () => void cleared++);
    return { pending, cleared: () => cleared };
  }

  it("clears at once when onSubmit returns nothing or true, as before", () => {
    expect(run(undefined).cleared()).toBe(1);
    expect(run(true).cleared()).toBe(1);
  });

  it("keeps the text when onSubmit returns false", () => {
    expect(run(false).cleared()).toBe(0);
  });

  it("waits for a promise, then clears unless it settles to false or rejects", async () => {
    const yes = run(Promise.resolve());
    expect(yes.cleared()).toBe(0);
    await yes.pending;
    expect(yes.cleared()).toBe(1);

    const no = run(Promise.resolve(false));
    await no.pending;
    expect(no.cleared()).toBe(0);

    const failed = run(Promise.reject(new Error("offline")));
    await failed.pending;
    expect(failed.cleared()).toBe(0);
  });

  it("keeps a new draft typed while the promise was pending", async () => {
    const typedOn = run(Promise.resolve(true), "And shoes to match");
    await typedOn.pending;
    expect(typedOn.cleared()).toBe(0);
  });

  it("only false keeps the text", () => {
    expect(shouldClear(false)).toBe(false);
    for (const value of [undefined, true, null, 0, ""]) expect(shouldClear(value)).toBe(true);
  });
});

describe("IntentInput while a send is pending", () => {
  function gate() {
    const pending = { current: false };
    const sent: string[] = [];
    const states: boolean[] = [];
    function send(text: string, result: SubmitResult | Promise<SubmitResult>) {
      return sendOnce(
        pending,
        () => {
          sent.push(text);
          return result;
        },
        (r) => afterSend(r, text, () => text, noop),
        (on) => states.push(on),
      );
    }
    return { pending, sent, states, send };
  }

  it("ignores a second Enter until the first send's promise settles", async () => {
    let finish!: () => void;
    const reply = new Promise<void>((resolve) => (finish = resolve));
    const g = gate();
    expect(g.send("A bag for a wedding", reply)).toBe(true);
    expect(g.pending.current).toBe(true);
    expect(g.send("A bag for a wedding", reply)).toBe(false);
    expect(g.sent).toEqual(["A bag for a wedding"]);
    finish();
    await reply;
    await Promise.resolve();
    expect(g.pending.current).toBe(false);
    expect(g.send("And shoes to match", undefined)).toBe(true);
    expect(g.sent).toEqual(["A bag for a wedding", "And shoes to match"]);
    expect(g.states).toEqual([true, false]);
  });

  it("opens again after a rejected send, so the buyer can retry", async () => {
    const failed = Promise.reject(new Error("offline"));
    const g = gate();
    g.send("A bag for a wedding", failed);
    expect(g.send("A bag for a wedding", undefined)).toBe(false);
    await failed.catch(noop);
    await Promise.resolve();
    await Promise.resolve();
    expect(g.send("A bag for a wedding", undefined)).toBe(true);
  });

  it("a plain result never holds the gate", () => {
    const g = gate();
    expect(g.send("one", undefined)).toBe(true);
    expect(g.send("two", false)).toBe(true);
    expect(g.send("three", true)).toBe(true);
    expect(g.sent).toEqual(["one", "two", "three"]);
    expect(g.states).toEqual([]);
  });
});

describe("rovingIndex", () => {
  it("wraps with arrows and jumps with Home and End", () => {
    expect(rovingIndex("ArrowRight", 0, 3)).toBe(1);
    expect(rovingIndex("ArrowRight", 2, 3)).toBe(0);
    expect(rovingIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(rovingIndex("ArrowLeft", 2, 3)).toBe(1);
    expect(rovingIndex("Home", 2, 3)).toBe(0);
    expect(rovingIndex("End", 0, 3)).toBe(2);
    expect(rovingIndex("Enter", 0, 3)).toBeNull();
    expect(rovingIndex("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("SegmentedControl", () => {
  it("one tab stop; the selected tab has fill, check and a 2px ink edge", () => {
    const out = html(
      <SegmentedControl
        id="sort"
        label="Sort"
        value="price"
        onChange={noop}
        options={[
          { value: "price", label: "Price" },
          { value: "rating", label: "Rating" },
        ]}
      />,
    );
    expect(out).toContain('role="tablist" aria-label="Sort"');
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-selected="true"[^>]*tabindex="0"/);
    const selected = out.match(/<button[^>]*aria-selected="true"[^>]*class="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(selected).toEqual(expect.arrayContaining(["bg-purple-soft", "border-2", "border-ink"]));
    expect(out.match(/lucide-check/g)).toHaveLength(1);
  });
});
