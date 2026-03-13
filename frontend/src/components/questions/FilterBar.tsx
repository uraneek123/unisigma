import { Filter, Search } from "lucide-react"

type Topic =
  | "all"
  | "algebra"
  | "calculus"
  | "geometry"
  | "probability"
  | "number-theory"

type Difficulty = "all" | "intro" | "intermediate" | "advanced"

type FilterBarProps = {
  search: string
  topic: Topic
  difficulty: Difficulty
  onSearchChange: (value: string) => void
  onTopicChange: (value: Topic) => void
  onDifficultyChange: (value: Difficulty) => void
}

export function FilterBar({
  search,
  topic,
  difficulty,
  onSearchChange,
  onTopicChange,
  onDifficultyChange,
}: FilterBarProps) {
  return (
    <section
      aria-label="Search and filter questions"
      className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Search className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight sm:text-lg">
              Find a math question
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Filter by topic, difficulty, and text to discover problems to
              solve.
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <Filter className="h-4 w-4" aria-hidden="true" />
          <span>Fully fluid layout · scalable UI</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by keyword, LaTeX, or title…"
            className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none ring-0 transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="flex flex-col gap-2 text-xs md:w-96 md:flex-row md:items-center">
          <div className="flex-1">
            <label className="mb-1 flex items-center justify-between text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Topic</span>
              <span id="topics" className="font-normal normal-case text-xs">
                {topic === "all" ? "All topics" : topic.replace("-", " ")}
              </span>
            </label>
            <select
              value={topic}
              onChange={(event) => onTopicChange(event.target.value as Topic)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs capitalize text-foreground outline-none ring-0 focus:border-ring focus:ring-2 focus:ring-ring/40"
            >
              <option value="all">All topics</option>
              <option value="algebra">Algebra</option>
              <option value="calculus">Calculus</option>
              <option value="geometry">Geometry</option>
              <option value="probability">Probability</option>
              <option value="number-theory">Number theory</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="mb-1 flex items-center justify-between text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Difficulty</span>
              <span id="latest" className="font-normal normal-case text-xs">
                {difficulty === "all"
                  ? "Any level"
                  : difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </span>
            </label>
            <select
              value={difficulty}
              onChange={(event) =>
                onDifficultyChange(event.target.value as Difficulty)
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs capitalize text-foreground outline-none ring-0 focus:border-ring focus:ring-2 focus:ring-ring/40"
            >
              <option value="all">Any level</option>
              <option value="intro">Intro</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  )
}

