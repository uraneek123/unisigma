import { AnimatePresence, motion } from "motion/react"
import { useMemo, useState } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { useProblems, useSources, useTags } from "@/api/hooks"
import "./App.css"
import { Landing } from "./components/landing/Landing"
import { Navbar } from "./components/layout/Navbar"
import { FilterBar } from "./components/questions/FilterBar"
import { QuestionDetail } from "./components/questions/QuestionDetail"
import { QuestionList } from "./components/questions/QuestionList"
import { UploadView } from "./components/upload/UploadView"
import { AboutPage } from "./pages/AboutPage"
import { LoginPage } from "./pages/LoginPage"
import { SignUpPage } from "./pages/SignUpPage"

const easeOutCubic = [0.25, 0.46, 0.45, 0.94] as const

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: easeOutCubic },
}

type MainView = "landing" | "questions" | "upload"

function MainApp() {
  const location = useLocation()
  const [view, setView] = useState<MainView>(
    () => (location.state?.view as MainView) || "landing"
  )
  const [search, setSearch] = useState("")
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null)
  const [sort, setSort] = useState("created_at_desc")
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null)
  const [answerDraft, setAnswerDraft] = useState("")

  const problemsFilter = useMemo(
    () => ({
      search: search.trim() || undefined,
      tag_ids: selectedTagId != null ? [selectedTagId] : undefined,
      source_ids: selectedSourceId != null ? [selectedSourceId] : undefined,
      sort,
    }),
    [search, selectedTagId, selectedSourceId, sort]
  )

  const { data: problems = [], isLoading: problemsLoading, error: problemsError } =
    useProblems(problemsFilter)
  const { data: tags = [] } = useTags()
  const { data: sources = [] } = useSources()

  const handleClearDetail = () => {
    setAnswerDraft("")
  }

  const handleChangeView = (v: MainView | "about") => {
    if (v !== "about") setView(v)
  }

  return (
    <>
      <Navbar view={view} onChangeView={handleChangeView} />
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
                selectedTagId={selectedTagId}
                selectedSourceId={selectedSourceId}
                sort={sort}
                tags={tags}
                sources={sources}
                onSearchChange={setSearch}
                onTagChange={setSelectedTagId}
                onSourceChange={setSelectedSourceId}
                onSortChange={setSort}
              />
              <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
                <QuestionList
                  problems={problems}
                  selectedProblemId={selectedQuestionId}
                  onSelectProblem={setSelectedQuestionId}
                  isLoading={problemsLoading}
                  error={problemsError ?? null}
                />
                <QuestionDetail
                  problemId={selectedQuestionId}
                  answerDraft={answerDraft}
                  onAnswerChange={setAnswerDraft}
                  onClear={handleClearDetail}
                  onSelectProblem={setSelectedQuestionId}
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
            <UploadView />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route
        path="/about"
        element={
          <>
            <Navbar view="about" onChangeView={() => {}} />
            <AboutPage />
          </>
        }
      />
      <Route path="/*" element={<MainApp />} />
    </Routes>
  )
}

export default App
