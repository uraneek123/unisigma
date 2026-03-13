import { FileText } from "lucide-react"

type Topic =
  | "all"
  | "algebra"
  | "calculus"
  | "geometry"
  | "probability"
  | "number-theory"

type Difficulty = "all" | "intro" | "intermediate" | "advanced"

export type Question = {
  id: number
  title: string
  topic: Exclude<Topic, "all">
  difficulty: Exclude<Difficulty, "all">
  summary: string
  latexSnippet: string
}

type QuestionListProps = {
  questions: Question[]
  selectedQuestionId: number | null
  onSelectQuestion: (id: number) => void
}

export function QuestionList({
  questions,
  selectedQuestionId,
  onSelectQuestion,
}: QuestionListProps) {
  return (
    <div className="flex min-h-[280px] flex-col rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold sm:text-base">Questions</h2>
        </div>
        <span className="text-xs text-muted-foreground sm:text-[0.8rem]">
          {questions.length} {questions.length === 1 ? "result" : "results"}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="h-full space-y-1 overflow-y-auto pr-1 text-sm">
          {questions.map((question) => (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelectQuestion(question.id)}
              className="group flex w-full flex-col gap-1.5 rounded-lg border border-transparent bg-background/70 px-3 py-2.5 text-left text-sm transition-colors hover:border-border/70 hover:bg-muted/70 data-[active=true]:border-primary/60 data-[active=true]:bg-primary/10"
              data-active={question.id === selectedQuestionId}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="line-clamp-2 text-[0.95rem] font-medium leading-snug">
                  {question.title}
                </h3>
                <span className="shrink-0 rounded-full border border-border/70 bg-muted/80 px-2.5 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                  {question.topic.replace("-", " ")}
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground sm:text-[0.8rem]">
                {question.summary}
              </p>
              <code className="mt-1 inline-flex max-w-full items-center truncate rounded-md bg-muted px-1.5 py-0.5 text-[0.75rem] font-mono text-foreground/80">
                {question.latexSnippet}
              </code>
            </button>
          ))}
          {questions.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-8 text-center text-xs text-muted-foreground sm:text-[0.8rem]">
              <p>No questions match these filters yet.</p>
              <p>
                Try broadening the topic or difficulty, or clearing your search.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

