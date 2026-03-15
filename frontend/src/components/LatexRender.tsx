import "katex/dist/katex.min.css"
import Latex from "react-latex-next"

type LatexRenderProps = {
  /** Raw LaTeX string (no delimiters). Will be wrapped in $$ for display or $ for inline. */
  content: string
  /** Use block (display) mode when true, inline when false. Default true. */
  displayMode?: boolean
  className?: string
}

/**
 * Renders LaTeX using react-latex-next. Wraps content in $$...$$ or $...$
 * so the library parses it. Use for problem statement_latex and similar fields.
 */
export function LatexRender({
  content,
  displayMode = true,
  className,
}: LatexRenderProps) {
  const trimmed = content.trim()
  if (!trimmed) return null

  const wrapped = displayMode ? `$$${trimmed}$$` : `$${trimmed}$`
  return (
    <span className={className}>
      <Latex>{wrapped}</Latex>
    </span>
  )
}
