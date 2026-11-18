"use client";

import { Check, Pencil, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, Chip, IconButton, SourceTag, TextInput, cn } from "@/pica/components/kit";
import type { CanvasEdit } from "@/pica/lib/session";
import { CATEGORIES, type Canvas, type CanvasItem } from "@/pica/lib/types";
import { CanvasItemEditor, editButtonId, placeFocusAfterRemove } from "@/pica/features/parts";
import { CATEGORY_WORDS } from "@/pica/features/shared/categories";
import { newId } from "@/pica/features/shared/format";
import { parseBudget } from "./budget";
import { budgetFields, budgetText, categoryEdit, confirmEdit, itemAddEdit, itemsOfKind } from "./canvas-model";
import { CANVAS, GROUPS, needRowId, type NeedGroup } from "./canvas-panel-model";

/** A need to open with its form showing. `n` changes on each request, so the same need can open twice. */
export interface OpenRequest {
  id: string;
  n: number;
}

export interface CanvasPanelProps {
  canvas: Canvas;
  /** True while Pica replies: every control is off, and the panel says why. */
  locked: boolean;
  /** `ws.editCanvas`. Sends the analytics; returns whether the edit landed. */
  onEdit: (edit: CanvasEdit) => boolean;
  /** Keeps ids apart when the needs show twice on a page (the workspace sheet and a kit preview). */
  scope: string;
  /** "Edit" on a confirm card: this need opens with its form showing and focus in it. */
  openItem?: OpenRequest | null;
  /** Shows "Your needs" and its line. Off inside the sheet, whose title says it. */
  showHeading?: boolean;
  className?: string;
}

const QUIET_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-pill px-2 text-body font-medium text-ink underline-offset-4 hover:underline " +
  "disabled:cursor-not-allowed disabled:text-ink-muted";

/** Puts focus back on `ref` after a form closes, so a keyboard user stays in place. */
function useFocusAfterClose<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (open || !pending.current) return;
    pending.current = false;
    ref.current?.focus();
  }, [open]);
  return [ref, () => (pending.current = true)] as const;
}

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      {/* Focus lands here when a group's last need is removed. */}
      <h3 id={id} tabIndex={-1} className="text-body font-semibold text-ink">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SourceLine({ source, confirmLabel, onConfirm }: { source: CanvasItem["source"]; confirmLabel: string; onConfirm: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <SourceTag source={source} />
      {source === "inferred" ? (
        <Button variant="ghost" icon={Check} aria-label={confirmLabel} onClick={onConfirm}>
          {CANVAS.confirm}
        </Button>
      ) : null}
    </div>
  );
}

function OutcomeRow({ canvas, onEdit, scope }: Pick<CanvasPanelProps, "canvas" | "onEdit" | "scope">) {
  const outcome = canvas.outcome;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [editRef, focusBack] = useFocusAfterClose<HTMLButtonElement>(editing);

  function close() {
    focusBack();
    setEditing(false);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (onEdit({ kind: "outcome", text: text.trim() })) close();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-col gap-2">
        <TextInput label={CANVAS.outcomeField} hideLabel value={text} maxLength={200} autoFocus onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{CANVAS.save}</Button>
          <Button variant="ghost" onClick={close}>
            {CANVAS.cancel}
            <span className="sr-only"> {CANVAS.outcomeCancelTail}</span>
          </Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex items-start gap-1">
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2.5">
        <p className={cn("break-words text-body", outcome ? "text-ink" : "text-ink-soft")}>{outcome?.text ?? CANVAS.notSet}</p>
        {outcome ? (
          <SourceLine
            source={outcome.source}
            confirmLabel={CANVAS.outcomeConfirm}
            onConfirm={() => {
              if (onEdit(confirmEdit({ kind: "outcome" }))) editRef.current?.focus();
            }}
          />
        ) : null}
      </div>
      <IconButton
        ref={editRef}
        id={`${scope}-outcome-edit`}
        icon={Pencil}
        label={CANVAS.outcomeEdit}
        onClick={() => {
          setText(outcome?.text ?? "");
          setEditing(true);
        }}
      />
    </div>
  );
}

function CategoryChips({ canvas, onEdit, scope }: Pick<CanvasPanelProps, "canvas" | "onEdit" | "scope">) {
  const labelId = `${scope}-category`;
  return (
    <div className="flex flex-col gap-1 pt-1">
      <p id={labelId} className="text-caption text-ink-soft">
        {CANVAS.category}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={CATEGORY_WORDS[category].one}
            selected={canvas.category === category}
            onClick={() => onEdit(categoryEdit(canvas.category, category))}
          />
        ))}
      </div>
    </div>
  );
}

function BudgetRow({ canvas, onEdit, scope }: Pick<CanvasPanelProps, "canvas" | "onEdit" | "scope">) {
  const budget = canvas.budget;
  const [editing, setEditing] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [errors, setErrors] = useState<{ min?: string; max?: string }>({});
  const [editRef, focusBack] = useFocusAfterClose<HTMLButtonElement>(editing);

  function close() {
    setErrors({});
    focusBack();
    setEditing(false);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const parsed = parseBudget(min, max);
    if (!parsed.ok) {
      // Keep the old budget and the form open, and say what to fix.
      setErrors(parsed.errors);
      return;
    }
    if (onEdit({ kind: "budget", minUsd: parsed.minUsd, maxUsd: parsed.maxUsd })) close();
  }

  if (editing) {
    return (
      <form onSubmit={save} noValidate className="flex flex-col gap-2">
        <div className="grid grid-cols-1 items-start gap-2 min-[360px]:grid-cols-2">
          <TextInput label={CANVAS.budgetMin} inputMode="decimal" value={min} error={errors.min} autoFocus onChange={(e) => setMin(e.target.value)} />
          <TextInput label={CANVAS.budgetMax} inputMode="decimal" value={max} error={errors.max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{CANVAS.saveBudget}</Button>
          <Button variant="ghost" onClick={close}>
            {CANVAS.cancel}
            <span className="sr-only"> {CANVAS.budgetCancelTail}</span>
          </Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex items-start gap-1">
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2.5">
        <p className={cn("text-body", budget ? "text-ink" : "text-ink-soft")}>{budgetText(budget)}</p>
        {budget ? (
          <SourceLine
            source={budget.source}
            confirmLabel={CANVAS.budgetConfirm}
            onConfirm={() => {
              if (onEdit(confirmEdit({ kind: "budget" }))) editRef.current?.focus();
            }}
          />
        ) : null}
      </div>
      <IconButton
        ref={editRef}
        id={`${scope}-budget-edit`}
        icon={Pencil}
        label={CANVAS.budgetEdit}
        onClick={() => {
          const fields = budgetFields(budget);
          setMin(fields.min);
          setMax(fields.max);
          setErrors({});
          setEditing(true);
        }}
      />
    </div>
  );
}

function AddNeed({ group, onEdit }: { group: NeedGroup; onEdit: CanvasPanelProps["onEdit"] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [addRef, focusBack] = useFocusAfterClose<HTMLButtonElement>(open);
  if (!group.add) return null;
  const { label, noun } = group.add;

  function close() {
    focusBack();
    setText("");
    setOpen(false);
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const edit = itemAddEdit(group.kind, text, newId());
    if (edit && onEdit(edit)) close();
  }

  if (!open) {
    return (
      <div>
        <button ref={addRef} type="button" onClick={() => setOpen(true)} className={QUIET_LINK}>
          <Plus aria-hidden size={16} />
          <span>{label}</span>
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={add} className="flex flex-col gap-2">
      <TextInput label={label} hideLabel value={text} maxLength={200} autoFocus onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          {CANVAS.add}
          <span className="sr-only"> {noun}</span>
        </Button>
        <Button variant="ghost" onClick={close}>
          {CANVAS.cancel}
          <span className="sr-only"> adding {noun}</span>
        </Button>
      </div>
    </form>
  );
}

/**
 * The needs (brief 6.2): what the buyer is after, the budget, must-haves,
 * nice-to-haves and what is still open, each marked "You said" or "Pica's
 * guess". It shows in the needs sheet at every width. Every
 * edit goes through `onEdit`. Locked while Pica replies, and says so.
 */
export function CanvasPanel({ canvas, locked, onEdit, scope, openItem = null, showHeading = true, className }: CanvasPanelProps) {
  const headingId = `${scope}-needs-title`;

  // "Edit" on a confirm card: focus the need's field. A timer, so it runs
  // after a sheet opening in the same commit has placed its own focus.
  useEffect(() => {
    if (!openItem) return;
    const timer = setTimeout(() => {
      document.getElementById(needRowId(scope, openItem.id))?.querySelector<HTMLInputElement>("input")?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [openItem, scope]);

  return (
    <section aria-labelledby={showHeading ? headingId : undefined} aria-label={showHeading ? undefined : CANVAS.title} className={cn("flex flex-col gap-5", className)}>
      {showHeading ? (
        <div className="flex flex-col gap-1">
          <h2 id={headingId} tabIndex={-1} className="text-heading font-semibold text-ink">
            {CANVAS.title}
          </h2>
          <p className="text-body text-ink-soft">{CANVAS.line}</p>
        </div>
      ) : null}
      {locked ? <p className="rounded-image bg-canvas px-4 py-3 text-body font-medium text-ink">{CANVAS.locked}</p> : null}

      {/* A disabled fieldset turns off every control inside it, open forms included. */}
      <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <Group id={`${scope}-outcome`} title={CANVAS.outcome}>
          <OutcomeRow canvas={canvas} onEdit={onEdit} scope={scope} />
          <CategoryChips canvas={canvas} onEdit={onEdit} scope={scope} />
        </Group>
        <Group id={`${scope}-budget`} title={CANVAS.budget}>
          <BudgetRow canvas={canvas} onEdit={onEdit} scope={scope} />
        </Group>
        {GROUPS.map((group) => {
          const items = itemsOfKind(canvas, group.kind);
          const groupId = `${scope}-${group.kind}`;
          const ids = items.map((item) => item.id);
          return (
            <Group key={group.kind} id={groupId} title={group.title}>
              {items.length === 0 ? <p className="text-body text-ink-soft">{CANVAS.none}</p> : null}
              <ul className="flex flex-col gap-2">
                {items.map((item) => {
                  const opening = openItem?.id === item.id;
                  return (
                    // Keyed by id, so saving keeps the row and its focus. A
                    // request to open it gives it a new key, so it opens.
                    <li key={opening ? `${item.id}:${openItem.n}` : item.id} id={needRowId(scope, item.id)}>
                      <CanvasItemEditor
                        item={item}
                        onEdit={onEdit}
                        locked={locked}
                        defaultEditing={opening}
                        editButtonId={editButtonId(scope, item.id)}
                        onRemoved={() => placeFocusAfterRemove({ scope, ids, removedId: item.id, headingId: groupId })}
                      />
                    </li>
                  );
                })}
              </ul>
              <AddNeed group={group} onEdit={onEdit} />
            </Group>
          );
        })}
      </fieldset>
    </section>
  );
}
