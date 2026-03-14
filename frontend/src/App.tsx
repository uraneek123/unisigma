import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import "./App.css"
import { Landing } from "./components/landing/Landing"
import { Navbar } from "./components/layout/Navbar"
import { FilterBar } from "./components/questions/FilterBar"
import { QuestionDetail } from "./components/questions/QuestionDetail"
import { QuestionList, type Question } from "./components/questions/QuestionList"

const easeOutCubic = [0.25, 0.46, 0.45, 0.94] as const

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: easeOutCubic },
}

type MainView = "landing" | "questions" | "upload"

const MOCK_QUESTIONS: Question[] = [
  {
    id: 1,
    title: "Prove that the sum of the first n squares is n(n+1)(2n+1)/6",
    topic: "algebra",
    difficulty: "intermediate",
    summary: "Classic induction problem. Base case and inductive step with polynomial manipulation.",
    latexSnippet: "\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}",
  },
  {
    id: 2,
    title: "Convergence of the series 1/n^p for p > 1",
    topic: "calculus",
    difficulty: "advanced",
    summary: "Integral test and p-series. Discuss convergence and divergence behavior.",
    latexSnippet: "\\sum_{n=1}^{\\infty} \\frac{1}{n^p}",
  },
  {
    id: 3,
    title: "Euler's formula and the complex exponential",
    topic: "calculus",
    difficulty: "intro",
    summary: "Derive e^(iπ) + 1 = 0 and connections to trigonometry.",
    latexSnippet: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta",
  },
  {
    id: 4,
    title: "Pythagorean theorem via similar triangles",
    topic: "geometry",
    difficulty: "intro",
    summary: "Proof using similarity and area. No algebra required.",
    latexSnippet: "a^2 + b^2 = c^2",
  },
  {
    id: 5,
    title: "Infinite primes: Euclid's proof",
    topic: "number-theory",
    difficulty: "intro",
    summary: "Assume finitely many primes; construct a new prime. Elementary number theory.",
    latexSnippet: "p_1 p_2 \\cdots p_n + 1",
  },
  {
    id: 6,
    title: "Bayes' theorem and conditional probability",
    topic: "probability",
    difficulty: "intermediate",
    summary: "Derive P(A|B) from P(B|A) and priors. Application example.",
    latexSnippet: "P(A\\mid B) = \\frac{P(B\\mid A)P(A)}{P(B)}",
  },
]

function App() {
  const [view, setView] = useState<MainView>("landing")
  const [search, setSearch] = useState("")
  const [topic, setTopic] = useState<"all" | "algebra" | "calculus" | "geometry" | "probability" | "number-theory">("all")
  const [difficulty, setDifficulty] = useState<"all" | "intro" | "intermediate" | "advanced">("all")
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null)
  const [answerDraft, setAnswerDraft] = useState("")
  const [latexChangeRequest, setLatexChangeRequest] = useState("")

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOCK_QUESTIONS.filter((question) => {
      if (topic !== "all" && question.topic !== topic) return false
      if (difficulty !== "all" && question.difficulty !== difficulty) return false
      if (q && !(question.title.toLowerCase().includes(q) || question.summary.toLowerCase().includes(q) || question.latexSnippet.toLowerCase().includes(q))) return false
      return true
    })
  }, [search, topic, difficulty])

  const selectedQuestion = selectedQuestionId != null ? MOCK_QUESTIONS.find((q) => q.id === selectedQuestionId) : undefined

  const handleClearDetail = () => {
    setAnswerDraft("")
    setLatexChangeRequest("")
  }

  return (
    <>
      <Navbar view={view} onChangeView={setView} />
      <AnimatePresence mode="wait">
        {view === "landing" && (
          <motion.div key="landing" {...pageTransition}>
            <Landing onGetStarted={() => setView("questions")} />
          </motion.div>
        )}
        {view === "questions" && (
          <motion.div
            key="questions"
            className="mx-auto max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"
            {...pageTransition}
          >
            <div className="space-y-4">
              <FilterBar
                search={search}
                topic={topic}
                difficulty={difficulty}
                onSearchChange={setSearch}
                onTopicChange={setTopic}
                onDifficultyChange={setDifficulty}
              />
              <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
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
                  onClear={handleClearDetail}
                />
              </div>
            </div>
          </motion.div>
        )}
        {view === "upload" && (
          <motion.div
            key="upload"
            className="mx-auto max-w-7xl flex-1 px-4 py-12 sm:px-6 lg:px-8"
            {...pageTransition}
          >
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/70 bg-card/60 px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Upload documents</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Upload LaTeX or PDF documents to add questions to the math Stack Exchange database. This flow will be wired up to the backend next.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default App
