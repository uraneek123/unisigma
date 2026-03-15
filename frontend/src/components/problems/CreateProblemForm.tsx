import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useRef } from "react"
import {
  createProblem,
  fetchTags,
  ocrLatex,
  type ProblemCreate,
  type TagRead,
} from "../../lib/api"
import { LatexRender } from "../LatexRender"
import { Button } from "../ui/button"

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
const labelClass = "text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground"

type CreateProblemFormProps = {
  onSuccess?: () => void
  initialLatex?: string
  initialMarkdown?: string
  initialStatementText?: string
}

export function CreateProblemForm({
  onSuccess,
  initialLatex = "",
  initialMarkdown = "",
  initialStatementText = "",
}: CreateProblemFormProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [statementText, setStatementText] = useState(initialStatementText)
  const [statementLatex, setStatementLatex] = useState(initialLatex)
  const [contentMarkdown, setContentMarkdown] = useState(initialMarkdown)
  const [notes, setNotes] = useState("")
  const [tagIds, setTagIds] = useState<number[]>([])
  const [suggestedTagNames, setSuggestedTagNames] = useState("")
  const [submittedBy, setSubmittedBy] = useState("")
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const { data: tags = [] } = useQuery({ queryKey: ["tags"], queryFn: fetchTags })

  const createMutation = useMutation({
    mutationFn: (payload: ProblemCreate) => createProblem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problems"] })
      onSuccess?.()
    },
  })

  const handleOcrFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrError(null)
    setOcrLoading(true)
    try {
      const result = await ocrLatex(file, { ocr_mode: "auto", strip_math_delimiters: false })
      setStatementLatex((prev) => (prev ? prev + "\n" + result.latex : result.latex))
      if (result.markdown) {
        setContentMarkdown((prev) => (prev ? prev + "\n\n" + result.markdown! : result.markdown ?? ""))
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "OCR failed")
    } finally {
      setOcrLoading(false)
      e.target.value = ""
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    const hasText = statementText.trim().length > 0
    const hasMarkdown = contentMarkdown.trim().length > 0
    if (!hasText && !hasMarkdown) {
      setValidationError("Provide at least a title (statement text) or content (Markdown).")
      return
    }

    const payload: ProblemCreate = {
      statement_text: hasText ? statementText.trim() : undefined,
      statement_latex: statementLatex.trim() || undefined,
      content_markdown: hasMarkdown ? contentMarkdown.trim() : undefined,
      notes: notes.trim() || undefined,
      submitted_by: submittedBy.trim() || undefined,
      auto_generate_latex: true,
      tag_ids: tagIds.length ? tagIds : undefined,
      suggested_tag_names: suggestedTagNames
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean),
    }
    createMutation.mutate(payload, {
      onSuccess: () => {
        setStatementText("")
        setStatementLatex("")
        setContentMarkdown("")
        setNotes("")
        setTagIds([])
        setSuggestedTagNames("")
        setSubmittedBy("")
        setValidationError(null)
      },
    })
  }

  const toggleTag = (tag: TagRead) => {
    setTagIds((prev) =>
      prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Convert image to LaTeX */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-4">
        <p className={labelClass}>Extract LaTeX from image</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a PNG, JPG, or WebP image to extract math/formula LaTeX. Result is appended below.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={handleOcrFile}
          className="mt-2 hidden"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ocrLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {ocrLoading ? "Extracting…" : "Choose image"}
          </Button>
          {ocrError && (
            <span className="text-xs text-destructive">{ocrError}</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Title / statement (plain text)</label>
          <input
            type="text"
            className={inputClass + " mt-1"}
            placeholder="Short title or problem statement"
            value={statementText}
            onChange={(e) => setStatementText(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Submitted by (optional)</label>
          <input
            type="text"
            className={inputClass + " mt-1"}
            placeholder="Username"
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Statement LaTeX</label>
        <textarea
          className={inputClass + " mt-1 min-h-[100px] resize-y font-mono text-[0.9em]"}
          placeholder="LaTeX for the problem statement (or use image above)"
          value={statementLatex}
          onChange={(e) => setStatementLatex(e.target.value)}
        />
        {statementLatex.trim() && (
          <div className="mt-2 rounded-md border border-border/60 bg-muted/40 p-3">
            <p className={labelClass + " mb-1"}>Preview</p>
            <div className="min-h-[2rem] text-[0.9rem] [&_.katex]:text-[0.95rem]">
              <LatexRender content={statementLatex} displayMode />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Content (Markdown)</label>
        <textarea
          className={inputClass + " mt-1 min-h-[120px] resize-y"}
          placeholder="Full problem content in Markdown. At least one of title or content is required."
          value={contentMarkdown}
          onChange={(e) => setContentMarkdown(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Notes (optional)</label>
        <input
          type="text"
          className={inputClass + " mt-1"}
          placeholder="Internal notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Tags</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag)}
              className={
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors " +
                (tagIds.includes(tag.id)
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted")
              }
            >
              {tag.name}
            </button>
          ))}
        </div>
        <input
          type="text"
          className={inputClass + " mt-2"}
          placeholder="New tag names (comma-separated)"
          value={suggestedTagNames}
          onChange={(e) => setSuggestedTagNames(e.target.value)}
        />
      </div>

      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}
      {createMutation.isError && (
        <p className="text-sm text-destructive">
          {createMutation.error instanceof Error ? createMutation.error.message : "Failed to create problem"}
        </p>
      )}
      {createMutation.isSuccess && (
        <p className="text-sm text-green-600 dark:text-green-400">Problem created.</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create problem"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setStatementText("")
            setStatementLatex("")
            setContentMarkdown("")
            setNotes("")
            setTagIds([])
            setSuggestedTagNames("")
            setSubmittedBy("")
            createMutation.reset()
          }}
        >
          Reset
        </Button>
      </div>
    </form>
  )
}
