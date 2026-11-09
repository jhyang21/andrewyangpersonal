/** Link that opens in a new tab and says so to screen readers. */
export default function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
