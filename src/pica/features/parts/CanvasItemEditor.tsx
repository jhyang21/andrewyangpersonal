"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, IconButton, SourceTag, TextInput } from "@/pica/components/kit";
import type { CanvasEdit } from "@/pica/lib/session";
import type { CanvasItem } from "@/pica/lib/types";
import { confirmEdit } from "@/pica/features/workspace/canvas-model";
import { EDITOR, editorLabels, editorSave } from "./canvas-item-model";

export interface CanvasItemEditorProps {
  /** One must-have, nice-to-have or open question from the canvas. */
  item: CanvasItem;
  /**
   * Applies an edit and says whether it landed. Pass `ws.editCanvas` from
   * `useWorkspace`: it sends `requirement_edited`. This part never sends
   * analytics or touches the store itself, so the event fires once.
   */
  onEdit: (edit: CanvasEdit) => boolean;
  /** True while Pica replies: every control is off. A disabled <fieldset> around it works too. */
  locked?: boolean;
  /** Open with the form showing, as when "Edit" on a confirm card opens this need. */
  defaultEditing?: boolean;
  /**
   * A stable id for this row's Edit button, such as `editButtonId(item.id)`,
   * so the list can move focus to it after another row is removed.
   */
  editButtonId?: string;
  /**
   * Called after Remove lands. The row is gone, so the list places focus:
   * lists call `placeFocusAfterRemove` here, which focuses the next row's
   * Edit button, else the one before, else the list's heading.
   */
  onRemoved?: () => void;
  className?: string;
}

/**
 * One need: its words, its source tag, and Confirm (for a guess), Edit and
 * Remove. Edit opens the words in place; saving a guess makes it the buyer's.
 * Focus goes back to Edit when the form closes and after Confirm. After
 * Remove the list places focus (see `onRemoved`). Render it inside an <li>
 * of the group's list.
 */
export function CanvasItemEditor({
  item,
  onEdit,
  locked = false,
  defaultEditing = false,
  editButtonId,
  onRemoved,
  className,
}: CanvasItemEditorProps) {
  const [editing, setEditing] = useState(defaultEditing);
  const [text, setText] = useState(item.text);
  const [error, setError] = useState<string | undefined>(undefined);
  const editButton = useRef<HTMLButtonElement>(null);
  const focusBack = useRef(false);
  const labels = editorLabels(item);

  useEffect(() => {
    if (editing || !focusBack.current) return;
    focusBack.current = false;
    editButton.current?.focus();
  }, [editing]);

  function close() {
    focusBack.current = true;
    setError(undefined);
    setEditing(false);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const step = editorSave(item, text);
    if (step.kind === "blank") {
      setError(EDITOR.blank);
      return;
    }
    // Keep the form open if the store refused the edit, so the words stay.
    if (step.kind === "edit" && !onEdit(step.edit)) return;
    close();
  }

  if (editing) {
    return (
      <form onSubmit={save} noValidate className={["flex flex-col gap-2", className ?? ""].join(" ").trim()}>
        <TextInput
          label={labels.field}
          hideLabel
          value={text}
          maxLength={200}
          autoFocus
          error={error}
          disabled={locked}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={locked}>
            {EDITOR.save}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setText(item.text);
              close();
            }}
          >
            {EDITOR.cancel}
            <span className="sr-only"> {labels.cancelTail}</span>
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className={["flex items-start gap-1", className ?? ""].join(" ").trim()}>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2.5">
        <p className="break-words text-body text-ink">{item.text}</p>
        <div className="flex flex-wrap items-center gap-1">
          <SourceTag source={item.source} />
          {item.source === "inferred" ? (
            <Button
              variant="ghost"
              icon={Check}
              disabled={locked}
              aria-label={labels.confirm}
              onClick={() => {
                // Confirm goes away once the need is the buyer's; Edit stays.
                if (onEdit(confirmEdit({ kind: "item", id: item.id }))) editButton.current?.focus();
              }}
            >
              {EDITOR.confirm}
            </Button>
          ) : null}
        </div>
      </div>
      <IconButton
        ref={editButton}
        id={editButtonId}
        icon={Pencil}
        label={labels.edit}
        disabled={locked}
        onClick={() => {
          setText(item.text);
          setError(undefined);
          setEditing(true);
        }}
      />
      <IconButton
        icon={Trash2}
        label={labels.remove}
        disabled={locked}
        onClick={() => {
          if (onEdit({ kind: "item_removed", id: item.id })) onRemoved?.();
        }}
      />
    </div>
  );
}
