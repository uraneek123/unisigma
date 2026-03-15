import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { useAuth } from "@/contexts/AuthContext"
import { useCreateProblem, useOcrLatex } from "@/api/hooks"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const UPLOAD_FORM_STORAGE_KEY = "upload-form-draft"

function loadDraft(): Partial<{
  statementText: string
  statementLatex: string
  contentMarkdown: string
  notes: string
  showOcr: boolean
  ocrEngine: "default" | "local" | "cloud"
}> {
  try {
    const raw = sessionStorage.getItem(UPLOAD_FORM_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      statementText: typeof parsed.statementText === "string" ? parsed.statementText : "",
      statementLatex: typeof parsed.statementLatex === "string" ? parsed.statementLatex : "",
      contentMarkdown: typeof parsed.contentMarkdown === "string" ? parsed.contentMarkdown : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      showOcr: Boolean(parsed.showOcr),
      ocrEngine:
        parsed.ocrEngine === "local" || parsed.ocrEngine === "cloud" ? parsed.ocrEngine : "default",
    }
  } catch {
    return {}
  }
}

function saveDraft(draft: {
  statementText: string
  statementLatex: string
  contentMarkdown: string
  notes: string
  showOcr: boolean
  ocrEngine: string
}) {
  try {
    sessionStorage.setItem(UPLOAD_FORM_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // ignore storage errors
  }
}

export function CreateProblemForm() {
  const { account } = useAuth()
  const createProblem = useCreateProblem()
  const ocrLatex = useOcrLatex()

  const draft = loadDraft()
  const [statementText, setStatementText] = useState(draft.statementText ?? "")
  const [statementLatex, setStatementLatex] = useState(draft.statementLatex ?? "")
  const [contentMarkdown, setContentMarkdown] = useState(draft.contentMarkdown ?? "")
  const [notes, setNotes] = useState(draft.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<number | null>(null)
  const [showOcr, setShowOcr] = useState(draft.showOcr ?? false)
  const [ocrEngine, setOcrEngine] = useState<"default" | "local" | "cloud">(
    draft.ocrEngine ?? "default"
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    saveDraft({
      statementText,
      statementLatex,
      contentMarkdown,
      notes,
      showOcr,
      ocrEngine,
    })
  }, [statementText, statementLatex, contentMarkdown, notes, showOcr, ocrEngine])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setSelectedFile(file ?? null)
    setError(null)
    e.target.value = ""
  }

  const handleConvertToLatex = () => {
    if (!selectedFile) return
    const isPdf =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf")
    const engine = isPdf ? "cloud" : ocrEngine
    if (isPdf && ocrEngine !== "cloud") setOcrEngine("cloud")
    setError(null)
    ocrLatex.mutate(
      { file: selectedFile, options: { ocr_engine: engine } },
      {
        onSuccess: (data) => {
          if (data.latex)
            setStatementLatex((prev) =>
              prev ? prev + "\n" + data.latex : data.latex
            )
          if (data.markdown != null)
            setContentMarkdown((prev) =>
              prev ? prev + "\n\n" + data.markdown : data.markdown ?? ""
            )
        },
        onError: (err) => setError(err.message),
      }
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessId(null)
    createProblem.mutate(
      {
        statement_text: statementText.trim() || undefined,
        statement_latex: statementLatex.trim() || undefined,
        content_markdown: contentMarkdown.trim() || undefined,
        notes: notes.trim() || undefined,
        submitted_by: account?.username,
      },
      {
        onSuccess: (data) => {
          setStatementText("")
          setStatementLatex("")
          setContentMarkdown("")
          setNotes("")
          setSuccessId(data.id)
          try {
            sessionStorage.removeItem(UPLOAD_FORM_STORAGE_KEY)
          } catch {
            // ignore
          }
        },
        onError: (err) => setError(err.message),
      }
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="border-border/60 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-sm sm:text-base">
            Create problem
          </CardTitle>
          <CardDescription>
            Add a problem using plain text and/or LaTeX. Optionally convert an image to LaTeX to fill the LaTeX and content fields.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {successId != null && (
              <Alert>
                <AlertDescription>
                  Problem created (ID: {successId}). Add tags, sources, and diagrams from the Questions page.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="create-title">Title (plain text, optional)</Label>
              <Input
                id="create-title"
                type="text"
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                placeholder="e.g. Sum of first n squares"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-latex">LaTeX (optional)</Label>
              <Textarea
                id="create-latex"
                value={statementLatex}
                onChange={(e) => setStatementLatex(e.target.value)}
                rows={2}
                className="font-mono text-sm"
                placeholder="e.g. \sum_{k=1}^{n} k^2 = \frac{n(n+1)(2n+1)}{6}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-content">Content (plain text or markdown, optional)</Label>
              <Textarea
                id="create-content"
                value={contentMarkdown}
                onChange={(e) => setContentMarkdown(e.target.value)}
                rows={5}
                placeholder="Full problem statement, steps, or markdown…"
              />
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowOcr((v) => !v)}
              >
                {showOcr ? "Hide image to LaTeX" : "Convert image to LaTeX (optional)"}
              </Button>
              {showOcr && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="space-y-2 min-w-0 sm:w-auto">
                      <Label htmlFor="create-ocr-engine">LaTeX conversion model</Label>
                      <Select
                        value={ocrEngine}
                        onValueChange={(v) => setOcrEngine(v as "default" | "local" | "cloud")}
                      >
                        <SelectTrigger id="create-ocr-engine" className="h-9 w-full sm:w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="local">Local</SelectItem>
                          <SelectItem value="cloud">Cloud</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 min-w-0 sm:w-auto">
                      <Label className="block text-sm font-medium">Image or PDF</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="cursor-pointer shrink-0">
                          <span className="inline-flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none focus-within:ring-2 focus-within:ring-ring/50 hover:bg-muted/50">
                            Choose file
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,application/pdf"
                            className="sr-only"
                            onChange={handleFileSelect}
                            disabled={ocrLatex.isPending}
                          />
                        </Label>
                        {selectedFile && (
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={selectedFile.name}>
                            {selectedFile.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={handleConvertToLatex}
                      disabled={!selectedFile || ocrLatex.isPending}
                    >
                      {ocrLatex.isPending ? "Converting…" : "Convert to LaTeX"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-notes">Notes (optional)</Label>
              <Input
                id="create-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes"
                className="h-9"
              />
            </div>

            <Button type="submit" size="sm" disabled={createProblem.isPending}>
              {createProblem.isPending ? "Creating…" : "Create problem"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
