"use client";

import { AnimatePresence, motion } from "framer-motion";
import { splitSentences } from "@/lib/cinematic-utils";
import { useReducedMotion } from "./ReducedMotionProvider";

type Props = {
  text: string;
  versionKey: number;
};

export function VersionedText({ text, versionKey }: Props) {
  const reduced = useReducedMotion();
  const sentences = splitSentences(text);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={versionKey}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: reduced ? 0.15 : 0.5, ease: "easeInOut" }}
        className="space-y-1"
      >
        {sentences.map((sentence, i) => (
          <motion.span
            key={`${versionKey}-${i}`}
            initial={reduced ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: reduced ? 0 : i * 0.06,
              ease: "easeOut",
            }}
            className="inline"
          >
            {sentence}{" "}
          </motion.span>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
