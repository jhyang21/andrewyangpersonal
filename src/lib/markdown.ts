import katex from "katex";

/** Minimal markdown-to-HTML converter with KaTeX math support. */
export function markdownToHtml(md: string): string {
  const mathBlocks: string[] = [];

  function renderMath(tex: string, displayMode: boolean): string {
    try {
      return katex.renderToString(tex.trim(), { displayMode, throwOnError: false });
    } catch {
      return `<code>${escapeHtml(tex)}</code>`;
    }
  }

  function stashMath(tex: string, displayMode: boolean): string {
    const index = mathBlocks.length;
    mathBlocks.push(renderMath(tex, displayMode));
    return `%%MATH_${index}%%`;
  }

  let html = md;

  // Display math ($$ ... $$)
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex) => stashMath(tex, true));

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`;
  });

  // Inline math ($ ... $)
  html = html.replace(/\$([^\$\n]+?)\$/g, (_m, tex) => stashMath(tex, false));

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr />");

  // Blockquote
  html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .map((l) => `<li>${l.slice(2)}</li>`)
      .join("\n");
    return `<ul>\n${items}\n</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block
      .split("\n")
      .filter((l) => /^\d+\. /.test(l))
      .map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`)
      .join("\n");
    return `<ol>\n${items}\n</ol>`;
  });

  // Paragraphs: wrap remaining bare lines
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|blockquote|pre|hr)/.test(trimmed)) return trimmed;
      if (/^%%MATH_\d+%%$/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n\n");

  // Restore math placeholders
  html = html.replace(/%%MATH_(\d+)%%/g, (_m, index) => mathBlocks[Number(index)]);

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
