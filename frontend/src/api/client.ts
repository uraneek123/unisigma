/**
 * API client for backend. Base URL from VITE_API_URL (default http://localhost:8000).
 * Call setActorUserId() to attach actor_user_id for authenticated requests.
 */

const BASE_URL =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/$/, "")
    : "http://localhost:8000"

let actorUserId: number | null = null

export function setActorUserId(id: number | null): void {
  actorUserId = id
}

export function getActorUserId(): number | null {
  return actorUserId
}

type ParamValue = string | number | undefined | (string | number)[]

function buildUrl(path: string, params?: Record<string, ParamValue>): string {
  const url = new URL(path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === "") return
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)))
      } else {
        url.searchParams.set(key, String(value))
      }
    })
  }
  return url.toString()
}

async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, ParamValue> } = {}
): Promise<T> {
  const { params, ...init } = options
  const url = buildUrl(path, params)
  const headers: HeadersInit = {
    ...(init.headers as Record<string, string>),
  }
  const body = init.body
  const isJsonBody =
    body != null &&
    (typeof body === "string" || (typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)))
  if (isJsonBody && !("Content-Type" in headers)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json"
  }
  const res = await fetch(url, {
    ...init,
    headers,
    body,
    mode: "cors",
  })
  if (!res.ok) {
    const text = await res.text()
    let detail: string
    try {
      const j = JSON.parse(text)
      const d = j.detail
      if (Array.isArray(d)) {
        detail = d
          .map(
            (e: { loc?: unknown[]; msg?: string }) =>
              `${(e.loc ?? []).join(".")}: ${e.msg ?? "validation error"}`
          )
          .join("; ")
      } else {
        detail = typeof d === "string" ? d : text || res.statusText
      }
    } catch {
      detail = text || res.statusText
    }
    throw new Error(detail)
  }
  const contentType = res.headers.get("Content-Type")
  if (contentType?.includes("application/json")) {
    return res.json() as Promise<T>
  }
  return res.text() as Promise<T>
}

function withActor(params: Record<string, ParamValue>): Record<string, ParamValue> {
  if (actorUserId != null) {
    return { ...params, actor_user_id: actorUserId }
  }
  return params
}

// --- Health ---
export function getHealth(): Promise<{ status: string; service?: string }> {
  return request("/health")
}

// --- Accounts ---
export function createAccount(payload: import("@/types/api").AccountCreate): Promise<import("@/types/api").AccountRead> {
  return request("/accounts", { method: "POST", body: JSON.stringify(payload) })
}

export function login(payload: {
  username: string
  password: string
}): Promise<import("@/types/api").AccountRead> {
  return request("/accounts/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function listAccounts(): Promise<import("@/types/api").AccountRead[]> {
  return request("/accounts", { params: withActor({}) })
}

export function getAccount(accountId: number): Promise<import("@/types/api").AccountRead> {
  return request(`/accounts/${accountId}`, { params: withActor({}) })
}

export function updateAccount(
  accountId: number,
  payload: import("@/types/api").AccountUpdate
): Promise<import("@/types/api").AccountRead> {
  return request(`/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    params: withActor({}),
  })
}

// --- Tags ---
export function listTags(): Promise<import("@/types/api").TagRead[]> {
  return request("/tags")
}

export function createTag(payload: import("@/types/api").TagCreate): Promise<import("@/types/api").TagRead> {
  return request("/tags", { method: "POST", body: JSON.stringify(payload) })
}

// --- Sources ---
export function listSources(): Promise<import("@/types/api").SourceRead[]> {
  return request("/sources")
}

export function createSource(
  payload: import("@/types/api").SourceCreate
): Promise<import("@/types/api").SourceRead> {
  return request("/sources", { method: "POST", body: JSON.stringify(payload) })
}

// --- Problems ---
export interface ProblemsFilter {
  search?: string
  tag_ids?: number[]
  source_ids?: number[]
  sort?: string
}

export function listProblems(
  params?: ProblemsFilter
): Promise<import("@/types/api").ProblemRead[]> {
  if (!params || Object.keys(params).length === 0) {
    return request("/problems")
  }
  const p: Record<string, ParamValue> = withActor({})
  const search = params.search?.trim()
  if (search) p.search = search
  if (params.sort) p.sort = params.sort
  if (params.tag_ids?.length) p.tag_id = params.tag_ids
  if (params.source_ids?.length) p.source_id = params.source_ids
  return request("/problems", { params: p })
}

export function getProblem(problemId: number): Promise<import("@/types/api").ProblemRead> {
  return request(`/problems/${problemId}`)
}

export function createProblem(
  payload: import("@/types/api").ProblemCreate
): Promise<import("@/types/api").ProblemRead> {
  const st = payload.statement_text?.trim()
  const cm = payload.content_markdown?.trim()
  const body: Record<string, unknown> = {
    tag_ids: payload.tag_ids ?? [],
    sources: payload.sources ?? [],
  }
  if (st) body.statement_text = st
  if (cm) body.content_markdown = cm
  if (!st && !cm) body.statement_text = "Untitled problem"
  if (payload.statement_latex != null && payload.statement_latex !== "") body.statement_latex = payload.statement_latex.trim()
  if (payload.notes != null && payload.notes !== "") body.notes = payload.notes.trim()
  if (payload.submitted_by != null && payload.submitted_by !== "") body.submitted_by = payload.submitted_by
  return request("/problems", {
    method: "POST",
    body: JSON.stringify(body),
    params: withActor({}),
  })
}

export function updateProblem(
  problemId: number,
  payload: import("@/types/api").ProblemUpdate
): Promise<import("@/types/api").ProblemRead> {
  return request(`/problems/${problemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    params: withActor({}),
  })
}

export function getSimilarProblems(problemId: number): Promise<import("@/types/api").ProblemRead[]> {
  return request(`/problems/${problemId}/similar`)
}

export function createSolution(
  problemId: number,
  payload: import("@/types/api").SolutionCreate
): Promise<import("@/types/api").SolutionRead> {
  return request(`/problems/${problemId}/solutions`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function uploadProblemDiagram(
  problemId: number,
  file: File,
  caption?: string | null
): Promise<import("@/types/api").DiagramUploadResponse> {
  const form = new FormData()
  form.append("file", file)
  if (caption != null && caption !== "") form.append("caption", caption)
  return request(`/problems/${problemId}/diagrams`, { method: "POST", body: form })
}

export function uploadEditorAsset(
  file: File,
  altText?: string | null
): Promise<import("@/types/api").EditorAssetUploadResponse> {
  const form = new FormData()
  form.append("file", file)
  if (altText != null && altText !== "") form.append("alt_text", altText)
  return request("/problems/assets", { method: "POST", body: form })
}

export interface OcrLatexOptions {
  ocr_mode?: string
  ocr_engine?: string
  ocr_server_type?: string | null
  ocr_language?: string | null
  strip_math_delimiters?: boolean
}

export function ocrLatex(
  file: File,
  options: OcrLatexOptions = {}
): Promise<import("@/types/api").OcrLatexResponse> {
  const form = new FormData()
  form.append("file", file)
  form.append("ocr_mode", options.ocr_mode ?? "auto")
  form.append("ocr_engine", options.ocr_engine ?? "default")
  if (options.ocr_server_type != null) form.append("ocr_server_type", options.ocr_server_type)
  if (options.ocr_language != null) form.append("ocr_language", options.ocr_language)
  form.append(
    "strip_math_delimiters",
    options.strip_math_delimiters != null ? String(options.strip_math_delimiters) : "false"
  )
  return request("/problems/ocr-latex", { method: "POST", body: form })
}

export interface OcrTextOptions {
  ocr_engine?: string
  ocr_server_type?: string | null
  ocr_language?: string | null
  text_tool?: string
  strip_cjk?: boolean
}

export function ocrText(
  file: File,
  options: OcrTextOptions = {}
): Promise<import("@/types/api").OcrTextResponse> {
  const form = new FormData()
  form.append("file", file)
  if (options.ocr_engine != null) form.append("ocr_engine", options.ocr_engine)
  if (options.ocr_server_type != null) form.append("ocr_server_type", options.ocr_server_type)
  if (options.ocr_language != null) form.append("ocr_language", options.ocr_language)
  if (options.text_tool != null) form.append("text_tool", options.text_tool)
  if (options.strip_cjk != null) form.append("strip_cjk", String(options.strip_cjk))
  return request("/problems/ocr-text", { method: "POST", body: form })
}
