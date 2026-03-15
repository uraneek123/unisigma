import { useState } from "react"
import { motion } from "motion/react"
import { useOcrLatex, useOcrText } from "@/api/hooks"
import { Button } from "@/components/ui/button"

type Mode = "latex" | "text"

export function OcrSection() {
  const [mode, setMode] = useState<Mode>("latex")
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const ocrLatex = useOcrLatex()
  const ocrText = useOcrText()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setResult("")
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult("")
    if (!file) {
      setError("Choose a file first.")
      return
    }
    if (mode === "latex") {
      ocrLatex.mutate(
        { file },
        {
          onSuccess: (data) => setResult(data.latex + (data.markdown ? "\n\n" + data.markdown : "")),
          onError: (err) => setError(err.message),
        }
      )
    } else {
      ocrText.mutate(
        { file },
        {
          onSuccess: (data) => setResult(data.text),
          onError: (err) => setError(err.message),
        }
      )
    }
  }

  const pending = ocrLatex.isPending || ocrText.isPending

  return (
    <motion.section
      className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h2 className="text-sm font-semibold">OCR</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Extract LaTeX or plain text from an image or PDF.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="radio"
              name="ocr-mode"
              checked={mode === "latex"}
              onChange={() => setMode("latex")}
              className="border-input"
            />
            LaTeX
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="radio"
              name="ocr-mode"
              checked={mode === "text"}
              onChange={() => setMode("text")}
              className="border-input"
            />
            Text
          </label>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            File (image or PDF)
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={handleFileChange}
            className="w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-xs"
          />
        </div>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <Button type="submit" size="sm" disabled={pending || !file}>
          {pending ? "Extracting…" : "Extract " + mode}
        </Button>
        {result && (
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Result
            </p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">
              {result}
            </pre>
          </div>
        )}
      </form>
    </motion.section>
  )
}
