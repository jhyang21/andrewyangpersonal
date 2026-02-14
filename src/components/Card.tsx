import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  fold?: boolean;
};

export function Card({ children, className = "", fold = false }: CardProps) {
  const foldClass = fold ? " card-fold" : "";
  return <article className={`paper-card p-5${foldClass} ${className}`}>{children}</article>;
}
