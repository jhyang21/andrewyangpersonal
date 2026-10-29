"use client";

import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { Manager, Store } from "@/lib/cup-notes/types";
import { STANCE_LABELS, T, clamp01 } from "./shared";

type Props = {
  store: Store;
  manager: Manager | null;
  order: number;
  t: number;
  onOpen: (storeKey: string) => void;
};

export function ManagerCard({ store, manager, order, t, onOpen }: Props) {
  const start = T.managerStart(order);
  const shown = manager !== null && t >= start;
  const spoken = clamp01((t - start - 150) / T.managerSpeak);
  const message = manager?.message_to_team ?? "";
  /* Cut on a word boundary so the line reads as speech, not as a glitch. */
  let cut = Math.ceil(spoken * message.length);
  if (cut < message.length) cut = Math.max(0, message.lastIndexOf(" ", cut));

  return (
    <motion.article
      className={`cn-card cn-mgr ${shown ? "" : "cn-card-wait"}`}
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
              {manager.tracks_compliance ? "Checking cups" : "Not checking"}
            </span>
            {manager.peak_exception && (
              <span className="cn-chip cn-chip-quiet">Rush: may skip</span>
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
            as the longer of the two and swapping them on hover or focus never moves the layout.
          */}
          <div className="cn-mgr-voice">
            <p className="cn-mgr-msg">
              <span className="sr-only">Tells the team: {message}</span>
              <span aria-hidden="true">
                &ldquo;{message.slice(0, cut)}
                <span className="cn-unsaid">{message.slice(cut)}</span>&rdquo;
              </span>
            </p>
            <p className="cn-mgr-thought">
              <span className="cn-mgr-thought-tag">Thinks, privately</span>
              {manager.private_thought}
            </p>
          </div>
        </>
      ) : (
        <p className="cn-wait-line">{manager ? "Reading the memo" : "Waiting for the memo"}</p>
      )}

      <button
        type="button"
        className="cn-mgr-open"
        onClick={() => onOpen(store.key)}
        disabled={!shown}
      >
        Open store
        <ChevronRight size={14} aria-hidden="true" />
        <span className="sr-only">: {store.name}</span>
      </button>
    </motion.article>
  );
}
