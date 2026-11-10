"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { clamp01 } from "@/cup-notes/lib/format";
import type { Manager, Store } from "@/cup-notes/lib/types";
import { MANAGER_FLAGS, STANCE_LABELS } from "@/cup-notes/lib/words";
import { T } from "./timeline";

type Props = {
  store: Store;
  manager: Manager | null;
  order: number;
  t: number;
};

export function ManagerCard({ store, manager, order, t }: Props) {
  const start = T.managerStart(order);
  const shown = manager !== null && t >= start;
  const spoken = clamp01((t - start - 150) / T.managerSpeak);
  const message = manager?.message_to_team ?? "";
  /* Cut on a word boundary so the line reads as speech, not as a glitch. */
  let cut = Math.ceil(spoken * message.length);
  if (cut < message.length) cut = Math.max(0, message.lastIndexOf(" ", cut));
  const [open, setOpen] = useState(false);

  return (
    <motion.article
      className={`cn-card cn-mgr ${shown ? "" : "cn-card-wait"} ${open ? "cn-mgr-flip" : ""}`}
      initial={false}
      animate={{ opacity: shown ? 1 : 0.55, y: shown ? 0 : 6 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <header>
        <p className="cn-mgr-store">{store.name}</p>
        <p className="cn-mgr-type">{store.type_label}</p>
      </header>

      <p className="cn-mgr-who">
        {store.manager.name}
        <span className="cn-chip">{store.manager.style_label}</span>
      </p>

      {shown && manager ? (
        <>
          <div className="cn-mgr-flags">
            <span className={`cn-chip cn-stance-${manager.stance}`}>
              {STANCE_LABELS[manager.stance]}
            </span>
            <span className="cn-chip cn-chip-quiet">
              {manager.tracks_compliance ? MANAGER_FLAGS.checking : MANAGER_FLAGS.notChecking}
            </span>
            {manager.peak_exception && (
              <span className="cn-chip cn-chip-quiet">{MANAGER_FLAGS.rushSkip}</span>
            )}
          </div>

          <div className="cn-meter" aria-label={`Intensity ${manager.intensity} of 100`}>
            <span>Intensity</span>
            <span className="cn-meter-track">
              <motion.span
                className="cn-meter-fill"
                initial={false}
                animate={{ width: `${manager.intensity}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </span>
            <span className="cn-meter-val">{manager.intensity}</span>
          </div>

          {/*
            The message and the private thought share one grid cell, so the card is always as tall
            as the longer of the two and swapping them never moves the layout. Tapping anywhere on
            the card swaps them (see .cn-mgr-voice in styles.css).
          */}
          <button
            type="button"
            className="cn-mgr-voice"
            aria-pressed={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="cn-mgr-msg">
              <span className="sr-only">Tells the team: {message}</span>
              <span aria-hidden="true">
                &ldquo;{message.slice(0, cut)}
                <span className="cn-unsaid">{message.slice(cut)}</span>&rdquo;
              </span>
            </span>
            <span className="cn-mgr-thought">
              <span className="cn-mgr-thought-tag">Thinks, privately</span>
              {manager.private_thought}
            </span>
          </button>
        </>
      ) : (
        <p className="cn-wait-line">{manager ? "Reading the memo" : "Waiting for the memo"}</p>
      )}

      <a className="cn-mgr-open" href={`#store-${store.key}`}>
        Open store
        <ChevronRight size={14} aria-hidden="true" />
        <span className="sr-only">: {store.name}</span>
      </a>
    </motion.article>
  );
}
