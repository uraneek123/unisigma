import { useState } from "react"
import { motion } from "motion/react"
import { useCreateSource, useSources } from "@/api/hooks"
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
import { Alert, AlertDescription } from "@/components/ui/alert"

export function SourcesSection() {
  const { data: sources = [], isLoading } = useSources()
  const createSource = useCreateSource()
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [year, setYear] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError("Title is required.")
      return
    }
    let yearNum: number | undefined
    if (year.trim()) {
      const parsed = parseInt(year.trim(), 10)
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 3000) {
        setError("Year must be 0–3000.")
        return
      }
      yearNum = parsed
    }
    createSource.mutate(
      {
        title: trimmedTitle,
        author: author.trim() || undefined,
        year: yearNum,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setTitle("")
          setAuthor("")
          setYear("")
          setNotes("")
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
            Sources
          </CardTitle>
          <CardDescription>
            Create and manage sources (books, papers, etc.) for problems.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading sources…</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-border/60 bg-background/70 px-2 py-1.5"
                >
                  <span className="font-medium">{s.title}</span>
                  {(s.author || s.year) && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {[s.author, s.year].filter(Boolean).join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="source-title">Title</Label>
              <Input
                id="source-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Calculus (Stewart)"
                className="h-9 max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-author">Author (optional)</Label>
              <Input
                id="source-author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="h-9 max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-year">Year (optional)</Label>
              <Input
                id="source-year"
                type="text"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2020"
                className="h-9 max-w-[6rem]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-notes">Notes (optional)</Label>
              <Input
                id="source-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 max-w-xs"
              />
            </div>
            <Button type="submit" size="sm" disabled={createSource.isPending}>
              {createSource.isPending ? "Adding…" : "Add source"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
