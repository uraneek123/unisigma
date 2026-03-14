import { motion } from "motion/react"

import { Button } from "../ui/button"

import type { Question } from "./QuestionList"

type QuestionDetailProps = {
  question: Question | undefined
  answerDraft: string
  latexChangeRequest: string
  onAnswerChange: (value: string) => void
  onLatexChange: (value: string) => void
  onClear: () => void
}

export function QuestionDetail({
  question,
  answerDraft,
  latexChangeRequest,
  onAnswerChange,
  onLatexChange,
  onClear,
}: QuestionDetailProps) {
  if (!question) {
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

  return (
    <motion.div
      className="flex min-h-[280px] flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      key={question.id}
    >
      <header className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold leading-snug sm:text-base">
            {question.title}
          </h2>
          <span className="shrink-0 rounded-full border border-border/70 bg-muted/80 px-2.5 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            {question.difficulty}
          </span>
        </div>
        <p className="text-xs text-muted-foreground sm:text-[0.8rem]">
          {question.summary}
        </p>
        <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[0.8rem] font-mono text-foreground/80">
          <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            LaTeX
          </span>
          <span>{question.latexSnippet}</span>
        </div>
      </header>

      <div className="grid flex-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground">
            Your answer
          </label>
          <textarea
            value={answerDraft}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="Write a structured, step-by-step solution. You can include LaTeX here; rendering and formatting will be handled later."
            className="min-h-[140px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground">
            Request changes to LaTeX
          </label>
          <textarea
            value={latexChangeRequest}
            onChange={(event) => onLatexChange(event.target.value)}
            placeholder="Describe how you’d like the LaTeX representation to change (notation fixes, alignment, structure, etc.)."
            className="min-h-[140px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </div>

      <div className="mt-1 flex flex-col gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:text-[0.8rem]">
        <p>
          Submissions are stored locally for now. Backend workflows and LaTeX
          translation will be wired up later.
        </p>
        <div className="flex gap-3">
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
            className="px-5 text-xs sm:text-sm"
          >
            Submit answer
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

