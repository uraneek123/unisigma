import { useState } from "react"
import { useUploadProblemDiagram } from "@/api/hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

const BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "http://localhost:8000"

type ProblemDiagramUploadProps = {
  problemId: number
  onSuccess?: () => void
}

export function ProblemDiagramUpload({ problemId, onSuccess }: ProblemDiagramUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState("")
  const [error, setError] = useState<string | null>(null)

  const uploadDiagram = useUploadProblemDiagram(problemId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError("Choose a PNG file.")
      return
    }
    if (!file.name.toLowerCase().endsWith(".png") && file.type !== "image/png") {
      setError("Only PNG images are supported.")
      return
    }
    uploadDiagram.mutate(
      { file, caption: caption.trim() || undefined },
      {
        onSuccess: () => {
          setFile(null)
          setCaption("")
          onSuccess?.()
        },
        onError: (err) => setError(err.message),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="diagram-file" className="text-xs">
          PNG file
        </Label>
        <input
          id="diagram-file"
          type="file"
          accept="image/png"
          onChange={handleFileChange}
          className="w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="diagram-caption" className="text-xs">
          Caption (optional)
        </Label>
        <Input
          id="diagram-caption"
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="h-8 max-w-xs text-xs"
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="sm" disabled={uploadDiagram.isPending || !file}>
        {uploadDiagram.isPending ? "Uploading…" : "Upload diagram"}
      </Button>
    </form>
  )
}

export function diagramImageUrl(imagePath: string): string {
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`
  return `${BASE_URL}${path}`
}
