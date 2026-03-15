import { useState } from "react"
import { motion } from "motion/react"

import { useAuth } from "@/contexts/AuthContext"
import {
  useCreateSolution,
  useCreateSource,
  useCreateTag,
  useProblem,
  useSimilarProblems,
  useSources,
  useTags,
  useUpdateProblem,
} from "@/api/hooks"
import { Button } from "../ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { ProblemSourceLinkCreate } from "@/types/api"
import { LatexRender } from "../LatexRender"
import {
  ProblemDiagramUpload,
  diagramImageUrl,
} from "./ProblemDiagramUpload"

type QuestionDetailProps = {
  problemId: number | null
  answerDraft: string
  onAnswerChange: (value: string) => void
  onClear: () => void
  onSelectProblem?: (id: number) => void
}

export function QuestionDetail({
  problemId,
  answerDraft,
  onAnswerChange,
  onClear,
  onSelectProblem,
}: QuestionDetailProps) {
  const { account } = useAuth()
  const { data: problem, isLoading, error } = useProblem(problemId)
  const similarQuery = useSimilarProblems(problemId)
  const createSolution = useCreateSolution(problemId ?? 0)
  const updateProblem = useUpdateProblem(problemId ?? 0)
  const { data: allTags = [] } = useTags()
  const { data: allSources = [] } = useSources()
  const createTag = useCreateTag()
  const createSource = useCreateSource()
  const [newTagName, setNewTagName] = useState("")
  const [newSourceTitle, setNewSourceTitle] = useState("")
  const [newSourceAuthor, setNewSourceAuthor] = useState("")
  const [newSourceYear, setNewSourceYear] = useState("")

  if (problemId == null) {
    return (
      <motion.div
        className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-card/60 px-4 py-10 text-center text-xs text-muted-foreground sm:text-[0.8rem]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <p>Select a question on the left to start answering.</p>
      </motion.div>
    )
  }

  if (isLoading) {
    return (
      <motion.div
        className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-card/60 px-4 py-10 text-center text-xs text-muted-foreground sm:text-[0.8rem]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <p>Loading question…</p>
      </motion.div>
    )
  }

  if (error || !problem) {
    return (
      <motion.div
        className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-card/60 px-4 py-10 text-center text-xs text-destructive sm:text-[0.8rem]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <p>{error?.message ?? "Problem not found."}</p>
      </motion.div>
    )
  }

  const handleSubmitAnswer = () => {
    if (!answerDraft.trim() || problemId == null) return
    createSolution.mutate(
      {
        body_text: answerDraft.trim(),
        submitted_by: account?.username ?? undefined,
      },
      {
        onSuccess: () => onClear(),
      }
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      key={problem.id}
    >
      <Card className="flex min-h-[280px] flex-col gap-3 border-border/60 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-heading text-sm leading-snug sm:text-base">
              {problem.statement_text}
            </h2>
            <Badge variant="secondary" className="shrink-0 text-[0.7rem] uppercase">
              {problem.moderation_status}
            </Badge>
          </div>
          {(problem.tags.length > 0 || problem.sources.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
              {problem.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tags
                  </span>
                  {problem.tags.map((t) => (
                    <Badge key={t.id} variant="secondary" className="text-xs font-normal">
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
              {problem.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sources
                  </span>
                  {problem.sources.map((s) => (
                    <Badge key={s.source.id} variant="outline" className="text-xs font-normal">
                      {s.source.title}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        {problem.statement_latex && (
          <div className="mt-1 flex flex-col gap-1 rounded-md bg-muted px-1.5 py-1 text-[0.8rem] text-foreground/90 [&_.katex]:text-[0.9rem]">
            <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              LaTeX
            </span>
            <LatexRender content={problem.statement_latex} displayMode />
          </div>
        )}
        {problem.content_markdown && (
          <div className="prose prose-sm max-w-none text-xs text-muted-foreground dark:prose-invert">
            <pre className="whitespace-pre-wrap font-sans">
              {problem.content_markdown}
            </pre>
          </div>
        )}
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-0">
        <Separator />

        <div className="space-y-3">
          <h3 className="border-l-2 border-primary/50 pl-2 text-sm font-heading font-semibold text-foreground">
            Tags & sources
          </h3>
          {updateProblem.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {updateProblem.error?.message ?? "Failed to update tags or sources."}
              </AlertDescription>
            </Alert>
          )}
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4 text-xs">
          <div>
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
              Tags on this problem
            </p>
            {problem.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {problem.tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-white bg-primary/20 px-2.5 py-1 text-xs shadow-sm ring-1 ring-primary/40 dark:border-white/90 dark:ring-white/30"
                  >
                    {t.name}
                    <button
                      type="button"
                      onClick={() => {
                        const newIds = problem.tags
                          .filter((tag) => tag.id !== t.id)
                          .map((tag) => tag.id)
                        updateProblem.mutate({ tag_ids: newIds })
                      }}
                      disabled={updateProblem.isPending}
                      className="text-destructive hover:underline disabled:opacity-50"
                      aria-label={`Remove ${t.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No tags yet. Add some below.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
              Sources on this problem
            </p>
            {problem.sources.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {problem.sources.map((link) => (
                  <span
                    key={link.source.id}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-white bg-primary/20 px-2.5 py-1 text-xs shadow-sm ring-1 ring-primary/40 dark:border-white/90 dark:ring-white/30"
                  >
                    {link.source.title}
                    {link.is_primary && (
                      <span className="text-[0.65rem] uppercase text-muted-foreground">
                        primary
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const current: ProblemSourceLinkCreate[] = problem.sources.map(
                          (s) => ({
                            source_id: s.source.id,
                            note: s.note,
                            is_primary: s.is_primary,
                          })
                        )
                        const newLinks = current.filter(
                          (l) => l.source_id !== link.source.id
                        )
                        updateProblem.mutate({ sources: newLinks })
                      }}
                      disabled={updateProblem.isPending}
                      className="text-destructive hover:underline disabled:opacity-50"
                      aria-label={`Remove ${link.source.title}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No sources yet. Add some below.</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
              Add an existing tag
            </p>
            <p className="mb-2 text-[0.65rem] text-muted-foreground">
              Click to add to this problem.
            </p>
            {(() => {
              const availableTags = allTags.filter(
                (t) => !problem.tags.some((pt) => pt.id === t.id)
              )
              return availableTags.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {availableTags.map((t) => (
                    <li key={t.id}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newIds = [
                            ...problem.tags.map((pt) => pt.id),
                            t.id,
                          ]
                          updateProblem.mutate({ tag_ids: newIds })
                        }}
                        disabled={updateProblem.isPending}
                        className="h-7 rounded-full text-xs"
                      >
                        {updateProblem.isPending ? "Adding…" : `+ ${t.name}`}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  No other tags. Create a new one below.
                </p>
              )
            })()}
          </div>

          <div>
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
              Create and add a new tag
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const name = newTagName.trim()
                if (!name) return
                createTag.mutate(
                  { name },
                  {
                    onSuccess: (tag) => {
                      const newIds = [
                        ...problem.tags.map((pt) => pt.id),
                        tag.id,
                      ]
                      updateProblem.mutate({ tag_ids: newIds })
                      setNewTagName("")
                    },
                  }
                )
              }}
            >
              <Input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name"
                className="h-8 flex-1 max-w-[140px] text-xs"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                className="ring-2 ring-border/50 ring-offset-2 ring-offset-card"
                disabled={!newTagName.trim() || createTag.isPending}
              >
                {createTag.isPending ? "Adding…" : "Add tag"}
              </Button>
            </form>
          </div>

          <div>
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
              Add an existing source
            </p>
            <p className="mb-2 text-[0.65rem] text-muted-foreground">
              Click to add to this problem.
            </p>
            {(() => {
              const availableSources = allSources.filter(
                (s) =>
                  !problem.sources.some((ps) => ps.source.id === s.id)
              )
              return availableSources.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {availableSources.map((s) => (
                    <li key={s.id}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const current: ProblemSourceLinkCreate[] =
                            problem.sources.map((link) => ({
                              source_id: link.source.id,
                              note: link.note,
                              is_primary: link.is_primary,
                            }))
                          updateProblem.mutate({
                            sources: [
                              ...current,
                              { source_id: s.id, is_primary: false },
                            ],
                          })
                        }}
                        disabled={updateProblem.isPending}
                        className="h-7 rounded-full text-xs"
                      >
                        {updateProblem.isPending ? "Adding…" : `+ ${s.title}`}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  No other sources. Create one below.
                </p>
              )
            })()}
          </div>

          <div>
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
              Create and add a new source
            </p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const title = newSourceTitle.trim()
                if (!title) return
                const yearNum = newSourceYear.trim()
                  ? parseInt(newSourceYear.trim(), 10)
                  : undefined
                if (
                  newSourceYear.trim() &&
                  (Number.isNaN(yearNum!) || yearNum! < 0 || yearNum! > 3000)
                )
                  return
                createSource.mutate(
                  {
                    title,
                    author: newSourceAuthor.trim() || undefined,
                    year: yearNum,
                  },
                  {
                    onSuccess: (source) => {
                      const current: ProblemSourceLinkCreate[] =
                        problem.sources.map((link) => ({
                          source_id: link.source.id,
                          note: link.note,
                          is_primary: link.is_primary,
                        }))
                      updateProblem.mutate({
                        sources: [
                          ...current,
                          { source_id: source.id, is_primary: false },
                        ],
                      })
                      setNewSourceTitle("")
                      setNewSourceAuthor("")
                      setNewSourceYear("")
                    },
                  }
                )
              }}
            >
              <Input
                type="text"
                value={newSourceTitle}
                onChange={(e) => setNewSourceTitle(e.target.value)}
                placeholder="New source title"
                className="h-8 w-32 text-xs"
              />
              <Input
                type="text"
                value={newSourceAuthor}
                onChange={(e) => setNewSourceAuthor(e.target.value)}
                placeholder="Author"
                className="h-8 w-24 text-xs"
              />
              <Input
                type="text"
                inputMode="numeric"
                value={newSourceYear}
                onChange={(e) => setNewSourceYear(e.target.value)}
                placeholder="Year"
                className="h-8 w-14 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                className="ring-2 ring-border/50 ring-offset-2 ring-offset-card"
                disabled={
                  !newSourceTitle.trim() || createSource.isPending
                }
              >
                {createSource.isPending ? "Adding…" : "Add source"}
              </Button>
            </form>
          </div>
        </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="border-l-2 border-primary/50 pl-2 text-sm font-heading font-semibold text-foreground">
            Diagrams
          </h3>
        {problem.diagrams.length > 0 && (
          <ul className="space-y-2 text-xs">
            {problem.diagrams.map((d) => (
              <li key={d.id} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                <img
                  src={diagramImageUrl(d.image_path)}
                  alt={d.caption ?? "Diagram"}
                  className="max-h-48 rounded object-contain"
                />
                {d.caption && (
                  <p className="mt-1 text-muted-foreground">{d.caption}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <ProblemDiagramUpload problemId={problem.id} />
        </div>

        {problem.solutions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="border-l-2 border-primary/50 pl-2 text-sm font-heading font-semibold text-foreground">
                Existing solutions
              </h3>
          <ul className="space-y-2 text-xs">
            {problem.solutions.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-border/60 bg-muted/10 p-3"
              >
                <p className="whitespace-pre-wrap">{s.body_text}</p>
                {s.submitted_by && (
                  <p className="mt-1 text-muted-foreground">
                    — {s.submitted_by}
                  </p>
                )}
              </li>
            ))}
            </ul>
            </div>
          </>
        )}

        <Separator />

        <div className="flex flex-1 flex-col gap-3">
          <h3 className="border-l-2 border-primary/50 pl-2 text-sm font-heading font-semibold text-foreground">
            Your answer
          </h3>
          <div className="rounded-lg border border-border/60 bg-muted/5 p-1">
            <Textarea
              value={answerDraft}
              onChange={(event) => onAnswerChange(event.target.value)}
              placeholder="Write a structured, step-by-step solution. You can include LaTeX here."
              className="min-h-[120px] flex-1 resize-none border-0 bg-transparent text-sm leading-relaxed focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:text-[0.8rem]">
          <p className="md:max-w-md">Submit your solution; it will be stored and can be moderated.</p>
          <div className="flex shrink-0 gap-3">
            <Button
              variant="secondary"
              size="default"
              type="button"
              className="px-4 text-xs sm:text-sm"
              onClick={onClear}
            >
              Clear
            </Button>
            <Button
              size="default"
              type="button"
              className="px-5 text-xs sm:text-sm shadow-md ring-2 ring-primary/20 ring-offset-2 ring-offset-card"
              onClick={handleSubmitAnswer}
              disabled={!answerDraft.trim() || createSolution.isPending}
            >
              {createSolution.isPending ? "Submitting…" : "Submit answer"}
            </Button>
          </div>
        </div>

        {similarQuery.data && similarQuery.data.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="border-l-2 border-primary/50 pl-2 text-sm font-heading font-semibold text-foreground">
                Similar problems
              </h3>
              <ul className="space-y-1.5 text-xs">
                {similarQuery.data.map((p) => (
                  <li key={p.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto w-full justify-start rounded-md py-1.5 text-left font-normal text-primary hover:bg-primary/10 hover:text-primary"
                      onClick={() => onSelectProblem?.(p.id)}
                    >
                      {p.statement_text.slice(0, 80)}
                      {p.statement_text.length > 80 ? "…" : ""}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
