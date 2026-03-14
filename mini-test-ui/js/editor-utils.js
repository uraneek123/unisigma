export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderMath(expr, displayMode, katex) {
  if (!katex) {
    return displayMode ? `<pre>${escapeHtml(expr)}</pre>` : escapeHtml(expr);
  }
  try {
    return katex.renderToString(expr, {
      throwOnError: false,
      displayMode,
    });
  } catch (_err) {
    return displayMode ? `<pre>${escapeHtml(expr)}</pre>` : escapeHtml(expr);
  }
}

export function buildMarkdownWithMathHtml(markdownText, deps = {}) {
  const markdown = (markdownText || "").trim();
  if (!markdown) {
    return "";
  }

  const markdownFactory = deps.markdownitFactory;
  const katex = deps.katex;

  const blocks = [];
  const inlines = [];
  let source = markdown.replace(/\r\n/g, "\n");

  source = source.replace(/\$\$([\s\S]+?)\$\$/g, (_match, expr) => {
    const index = blocks.push(expr.trim()) - 1;
    return `\n\n@@BLOCK_MATH_${index}@@\n\n`;
  });

  source = source.replace(/(?<!\\)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (_match, expr) => {
    const index = inlines.push(expr.trim()) - 1;
    return `@@INLINE_MATH_${index}@@`;
  });

  let html = "";
  if (markdownFactory) {
    const md = markdownFactory({
      breaks: true,
      html: false,
      linkify: true,
    });
    html = md.render(source);
  } else {
    html = escapeHtml(source).replaceAll("\n", "<br>");
  }

  html = html.replace(/@@BLOCK_MATH_(\d+)@@/g, (_match, index) =>
    renderMath(blocks[Number(index)] || "", true, katex)
  );
  html = html.replace(/@@INLINE_MATH_(\d+)@@/g, (_match, index) =>
    renderMath(inlines[Number(index)] || "", false, katex)
  );
  return html;
}

export function normalizeSelectionRect(start, end, maxWidth, maxHeight) {
  const left = Math.max(0, Math.min(start.x, end.x));
  const right = Math.min(maxWidth, Math.max(start.x, end.x));
  const top = Math.max(0, Math.min(start.y, end.y));
  const bottom = Math.min(maxHeight, Math.max(start.y, end.y));

  const width = Math.round(right - left);
  const height = Math.round(bottom - top);
  if (width < 2 || height < 2) {
    return null;
  }

  return {
    x: Math.round(left),
    y: Math.round(top),
    width,
    height,
  };
}

export function mapCanvasRectToImageRect(rect, scaleX, scaleY) {
  return {
    x: Math.round(rect.x * scaleX),
    y: Math.round(rect.y * scaleY),
    width: Math.max(1, Math.round(rect.width * scaleX)),
    height: Math.max(1, Math.round(rect.height * scaleY)),
  };
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
