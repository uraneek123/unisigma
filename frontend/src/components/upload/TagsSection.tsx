import { useState } from "react"
import { motion } from "motion/react"
import { useCreateTag, useTags } from "@/api/hooks"
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

export function TagsSection() {
  const { data: tags = [], isLoading } = useTags()
  const createTag = useCreateTag()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required.")
      return
    }
    createTag.mutate(
      { name: trimmed, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setName("")
          setDescription("")
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
            Tags
          </CardTitle>
          <CardDescription>
            Create and manage tags for problems.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading tags…</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <li
                  key={t.id}
                  className="rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs"
                >
                  {t.name}
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
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. algebra"
                className="h-9 max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-description">Description (optional)</Label>
              <Input
                id="tag-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="h-9 max-w-xs"
              />
            </div>
            <Button type="submit" size="sm" disabled={createTag.isPending}>
              {createTag.isPending ? "Adding…" : "Add tag"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
