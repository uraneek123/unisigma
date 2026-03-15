/**
 * Backend API client.
 * In dev, Vite proxies /api to the backend (default: http://127.0.0.1:8000).
 * Set VITE_API_URL in .env to override (e.g. http://localhost:8000 or full URL in production).
 */
const API_BASE = import.meta.env.VITE_API_URL ?? "/api"

async function getJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: string
    try {
      const body = await res.json()
      const msg = body?.detail ?? res.statusText
      detail = typeof msg === "string" ? msg : JSON.stringify(msg)
    } catch {
      detail = res.statusText || "Request failed"
    }
    throw new Error(detail)
  }
  return res.json()
}

export type Topic =
  | "algebra"
  | "calculus"
  | "geometry"
  | "probability"
  | "number-theory"
export type Difficulty = "intro" | "intermediate" | "advanced"

// --- Tags ---
export interface TagRead {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface TagCreate {
  name: string
  description?: string | null
}

// --- Sources ---
export interface SourceRead {
  id: number
  title: string
  author: string | null
  year: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SourceCreate {
  title: string
  author?: string | null
  year?: number | null
  notes?: string | null
}

export interface ProblemSourceLinkCreate {
  source_id: number
  note?: string | null
  is_primary?: boolean
}

// --- Problems ---
/** Backend problem as returned by GET /problems */
export interface ProblemRead {
  id: number
  statement_text: string
  statement_latex: string | null
  content_markdown: string | null
  notes: string | null
  submitted_by: string | null
  moderation_status: string
  created_at: string
  updated_at: string
  tags: { id: number; name: string }[]
  sources: unknown[]
  solutions: unknown[]
  diagrams: unknown[]
}

export interface ProblemCreate {
  statement_text?: string | null
  statement_latex?: string | null
  content_markdown?: string | null
  notes?: string | null
  author_id?: number | null
  submitted_by?: string | null
  auto_generate_latex?: boolean
  suggested_tag_names?: string[]
  suggested_sources?: SourceCreate[]
  moderation_status?: string
  tag_ids?: number[]
  sources?: ProblemSourceLinkCreate[]
}

export interface ProblemUpdate {
  statement_text?: string | null
  statement_latex?: string | null
  content_markdown?: string | null
  notes?: string | null
  moderation_status?: string | null
  tag_ids?: number[] | null
  sources?: ProblemSourceLinkCreate[] | null
}

// --- Solutions ---
export interface SolutionCreate {
  body_text: string
  body_latex?: string | null
  notes?: string | null
  submitted_by?: string | null
  moderation_status?: string
}

export interface SolutionRead {
  id: number
  body_text: string
  body_latex: string | null
  notes: string | null
  submitted_by: string | null
  moderation_status: string
  created_at: string
  updated_at: string
}

// --- OCR ---
export interface OcrLatexResponse {
  latex: string
  markdown: string | null
  mode_used: string
  strategy: string
}

export interface OcrTextResponse {
  text: string
  strategy: string
}

export interface OcrLatexOptions {
  ocr_mode?: "auto" | "formula" | "text_formula" | "page"
  ocr_engine?: "default" | "local" | "cloud"
  ocr_server_type?: "pro" | "plus" | "ultra"
  ocr_language?: string | null
  strip_math_delimiters?: boolean
}

/** Frontend question shape (used by QuestionList / QuestionDetail) */
export interface Question {
  id: number
  title: string
  topic: Topic
  difficulty: Difficulty
  summary: string
  latexSnippet: string
}

const TOPICS: Topic[] = [
  "algebra",
  "calculus",
  "geometry",
  "probability",
  "number-theory",
]
const DIFFICULTIES: Difficulty[] = ["intro", "intermediate", "advanced"]

function tagToTopic(tagNames: string[]): Topic {
  const lower = tagNames.map((n) => n.toLowerCase().replace(/\s+/g, "-"))
  for (const t of TOPICS) {
    if (lower.some((n) => n === t || n.includes(t))) return t
  }
  return "algebra"
}

function tagToDifficulty(tagNames: string[]): Difficulty {
  const lower = tagNames.map((n) => n.toLowerCase())
  for (const d of DIFFICULTIES) {
    if (lower.includes(d)) return d
  }
  return "intermediate"
}

export function mapProblemToQuestion(p: ProblemRead): Question {
  const tagNames = p.tags?.map((t) => t.name) ?? []
  const summary =
    p.notes?.trim() ||
    (p.content_markdown
      ? p.content_markdown.replace(/\s+/g, " ").slice(0, 200)
      : "") ||
    p.statement_text.slice(0, 120)
  return {
    id: p.id,
    title: p.statement_text || "Untitled",
    topic: tagToTopic(tagNames),
    difficulty: tagToDifficulty(tagNames),
    summary: summary.slice(0, 200),
    latexSnippet: p.statement_latex?.trim() || "",
  }
}

// --- Health ---
export async function healthCheck(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error("Health check failed")
  return res.json()
}

// --- Tags ---
export async function fetchTags(): Promise<TagRead[]> {
  const res = await fetch(`${API_BASE}/tags`)
  return getJson<TagRead[]>(res)
}

export async function createTag(payload: TagCreate): Promise<TagRead> {
  const res = await fetch(`${API_BASE}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return getJson<TagRead>(res)
}

// --- Sources ---
export async function fetchSources(): Promise<SourceRead[]> {
  const res = await fetch(`${API_BASE}/sources`)
  return getJson<SourceRead[]>(res)
}

export async function createSource(payload: SourceCreate): Promise<SourceRead> {
  const res = await fetch(`${API_BASE}/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return getJson<SourceRead>(res)
}

// --- Problems ---
export async function fetchProblems(): Promise<Question[]> {
  const res = await fetch(`${API_BASE}/problems`)
  const data: ProblemRead[] = await getJson<ProblemRead[]>(res)
  return data.map(mapProblemToQuestion)
}

export async function getProblem(problemId: number): Promise<ProblemRead> {
  const res = await fetch(`${API_BASE}/problems/${problemId}`)
  return getJson<ProblemRead>(res)
}

export async function createProblem(payload: ProblemCreate): Promise<ProblemRead> {
  const res = await fetch(`${API_BASE}/problems`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return getJson<ProblemRead>(res)
}

export async function updateProblem(
  problemId: number,
  payload: ProblemUpdate
): Promise<ProblemRead> {
  const res = await fetch(`${API_BASE}/problems/${problemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return getJson<ProblemRead>(res)
}

export async function getSimilarProblems(problemId: number): Promise<ProblemRead[]> {
  const res = await fetch(`${API_BASE}/problems/${problemId}/similar`)
  return getJson<ProblemRead[]>(res)
}

// --- OCR ---
export async function ocrLatex(
  file: File,
  options: OcrLatexOptions = {}
): Promise<OcrLatexResponse> {
  const form = new FormData()
  form.append("file", file)
  form.append("ocr_mode", options.ocr_mode ?? "auto")
  form.append("ocr_engine", options.ocr_engine ?? "default")
  form.append("strip_math_delimiters", String(options.strip_math_delimiters ?? false))
  if (options.ocr_server_type) form.append("ocr_server_type", options.ocr_server_type)
  if (options.ocr_language) form.append("ocr_language", options.ocr_language)

  const res = await fetch(`${API_BASE}/problems/ocr-latex`, {
    method: "POST",
    body: form,
  })
  return getJson<OcrLatexResponse>(res)
}

export async function ocrText(file: File): Promise<OcrTextResponse> {
  const form = new FormData()
  form.append("file", file)

  const res = await fetch(`${API_BASE}/problems/ocr-text`, {
    method: "POST",
    body: form,
  })
  return getJson<OcrTextResponse>(res)
}

// --- Solutions ---
export async function createSolution(
  problemId: number,
  payload: SolutionCreate
): Promise<SolutionRead> {
  const res = await fetch(`${API_BASE}/problems/${problemId}/solutions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return getJson<SolutionRead>(res)
}
