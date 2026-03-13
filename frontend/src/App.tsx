import { useMemo, useState } from "react"
import { UploadCloud } from "lucide-react"

import { Navbar } from "./components/layout/Navbar"
import { Landing } from "./components/landing/Landing"
import { FilterBar } from "./components/questions/FilterBar"
import {
  QuestionList,
  type Question as QuestionType,
} from "./components/questions/QuestionList"
import { QuestionDetail } from "./components/questions/QuestionDetail"

type Topic =
  | "all"
  | "algebra"
  | "calculus"
  | "geometry"
  | "probability"
  | "number-theory"

type Difficulty = "all" | "intro" | "intermediate" | "advanced"

type MainView = "landing" | "questions" | "upload"

const SAMPLE_QUESTIONS: QuestionType[] = [
  {
    id: 1,
    title: "Convergence of a power series around 0",
    topic: "calculus",
    difficulty: "intermediate",
    summary:
      "Determine the radius and interval of convergence for the series \\(\\sum_{n=0}^{\\infty} \\frac{x^n}{n+1}\\).",
    latexSnippet: "\\sum_{n=0}^{\\infty} \\frac{x^n}{n+1}",
  },
  {
    id: 2,
    title: "Group of units modulo n",
    topic: "algebra",
    difficulty: "advanced",
    summary:
      "Show that the units modulo \\(n\\) form an abelian group under multiplication and compute its order for \\(n = 15\\).",
    latexSnippet: "(\\mathbb{Z} / n \\mathbb{Z})^{\\times}",
  },
  {
    id: 3,
    title: "Expected value of a geometric random variable",
    topic: "probability",
    difficulty: "intro",
    summary:
      "Compute the expected number of trials until the first success for a geometric distribution with parameter \\(p\\).",
    latexSnippet: "\\mathbb{E}[X] = \\frac{1}{p}",
  },
]

function App() {
  const [view, setView] = useState<MainView>("landing")
  const [search, setSearch] = useState("")
  const [topic, setTopic] = useState<Topic>("all")
  const [difficulty, setDifficulty] = useState<Difficulty>("all")
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(
    SAMPLE_QUESTIONS[0]?.id ?? null,
  )
  const [answerDraft, setAnswerDraft] = useState("")
  const [latexChangeRequest, setLatexChangeRequest] = useState("")

  const filteredQuestions = useMemo(
    () =>
      SAMPLE_QUESTIONS.filter((q) => {
        if (topic !== "all" && q.topic !== topic) return false
        if (difficulty !== "all" && q.difficulty !== difficulty) return false
        if (!search.trim()) return true
        const haystack =
          `${q.title} ${q.summary} ${q.latexSnippet}`.toLowerCase()
        return haystack.includes(search.trim().toLowerCase())
      }),
    [search, topic, difficulty],
  )

  const selectedQuestion = filteredQuestions.find(
    (q) => q.id === selectedQuestionId,
  )

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Reserved for future unicorn.studio interactive background */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
        data-role="unicorn-studio-background"
      />

      <Navbar view={view} onChangeView={setView} />

      {view === "landing" ? (
        <Landing onGetStarted={() => setView("questions")} />
      ) : (
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <FilterBar
            search={search}
            topic={topic}
            difficulty={difficulty}
            onSearchChange={setSearch}
            onTopicChange={setTopic}
            onDifficultyChange={setDifficulty}
          />

          {view === "questions" ? (
            <section
              aria-label="Questions and answers"
              className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6"
            >
              <QuestionList
                questions={filteredQuestions}
                selectedQuestionId={selectedQuestionId}
                onSelectQuestion={setSelectedQuestionId}
              />
              <QuestionDetail
                question={selectedQuestion}
                answerDraft={answerDraft}
                latexChangeRequest={latexChangeRequest}
                onAnswerChange={setAnswerDraft}
                onLatexChange={setLatexChangeRequest}
                onClear={() => {
                  setAnswerDraft("")
                  setLatexChangeRequest("")
                }}
              />
            </section>
          ) : (
            <section
              aria-label="Upload document for LaTeX translation"
              className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6"
            >
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UploadCloud className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">
                      Upload a document to translate to LaTeX
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      This page prepares the flow for turning PDFs or images
                      into clean, editable LaTeX. Processing will be implemented
                      later.
                    </p>
                  </div>
                </div>

                <div className="mt-1 flex flex-1 flex-col gap-4">
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/40 px-4 py-10 text-center">
                    <input type="file" className="hidden" />
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <UploadCloud className="h-4 w-4 text-primary" />
                      <span>Select a file</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PDFs, images, or Markdown. We&apos;ll extract the math and
                      generate LaTeX in a later iteration.
                    </p>
                    <span className="mt-1 rounded-full bg-background/80 px-2 py-0.5 text-[0.7rem] text-muted-foreground">
                      Prototype only – no upload processing yet.
                    </span>
                  </label>

                  <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                    <h3 className="text-[0.75rem] font-semibold uppercase tracking-wide">
                      Coming soon
                    </h3>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>
                        Automatic LaTeX extraction from handwritten or typed
                        notes
                      </li>
                      <li>Side-by-side diff of original vs. LaTeX output</li>
                      <li>One-click publishing into uniSigma questions</li>
                    </ul>
                  </div>
                </div>
              </div>

              <aside
                id="about"
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-4 text-xs text-muted-foreground shadow-sm backdrop-blur"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  What is uniSigma?
                </h3>
                <p>
                  uniSigma is a math-first Q&amp;A environment inspired by Math
                  Stack Exchange, with a focus on precise LaTeX workflows,
                  collaborative refinement of notation, and a clear separation
                  between problem statements and solution threads.
                </p>
                <p>
                  This prototype focuses on the interaction model and fluid
                  layout. The upload-to-LaTeX pipeline and backend APIs will be
                  layered in next.
                </p>
              </aside>
            </section>
          )}
        </main>
      )}
    </div>
  )
}

export default App
