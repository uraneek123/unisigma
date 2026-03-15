import { FileText } from "lucide-react"
import { motion } from "motion/react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LatexRender } from "../LatexRender"
import type { ProblemRead } from "@/types/api"

type QuestionListProps = {
  problems: ProblemRead[]
  selectedProblemId: number | null
  onSelectProblem: (id: number) => void
  isLoading?: boolean
  error?: Error | null
}

export function QuestionList({
  problems,
  selectedProblemId,
  onSelectProblem,
  isLoading,
  error,
}: QuestionListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className="flex min-h-[280px] flex-col border-border/60 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading text-sm sm:text-base">
              Questions
            </CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {problems.length} {problems.length === 1 ? "result" : "results"}
          </Badge>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden pt-0">
          <div className="h-full space-y-1 overflow-y-auto pr-1 text-sm">
            {error && (
              <Alert variant="destructive" className="mb-2">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}
            {isLoading && (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                Loading…
              </div>
            )}
            {!isLoading && !error && problems.map((problem, index) => {
              const topicLabel =
                problem.tags.length > 0
                  ? problem.tags.map((t) => t.name).join(", ")
                  : "—"
              const summary =
                problem.notes?.slice(0, 120) ??
                problem.content_markdown?.slice(0, 120).replace(/#+/g, "").trim() ??
                ""
              return (
                <motion.button
                  key={problem.id}
                  type="button"
                  onClick={() => onSelectProblem(problem.id)}
                  className="group flex w-full flex-col gap-1.5 rounded-lg border border-transparent bg-background/70 px-3 py-2.5 text-left text-sm transition-colors hover:border-border/70 hover:bg-muted/70 data-[active=true]:border-l-4 data-[active=true]:border-l-primary data-[active=true]:border-primary/60 data-[active=true]:bg-primary/10 data-[active=true]:pl-2"
                  data-active={problem.id === selectedProblemId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: index * 0.04,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.995 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="line-clamp-2 text-[0.95rem] font-medium leading-snug">
                      {problem.statement_text}
                    </h3>
                    <Badge variant="outline" className="shrink-0 text-[0.7rem] font-normal">
                      {topicLabel}
                    </Badge>
                  </div>
                  {summary && (
                    <p className="line-clamp-2 text-xs text-muted-foreground sm:text-[0.8rem]">
                      {summary}
                    </p>
                  )}
                  {problem.statement_latex && (
                    <div className="mt-1 max-w-full overflow-x-auto rounded-md bg-muted px-1.5 py-0.5 text-[0.75rem] text-foreground/80 [&_.katex]:text-[0.8rem]">
                    <LatexRender
                      content={problem.statement_latex}
                      displayMode={false}
                    />
                  </div>
                  )}
                </motion.button>
              )
            })}
            {!isLoading && !error && problems.length === 0 && (
              <motion.div
                className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/40 px-4 py-8 text-center text-xs text-muted-foreground sm:text-[0.8rem]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <p>No questions match these filters yet.</p>
                <p>Try broadening the tag or clearing your search.</p>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
