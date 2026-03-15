/** Types mirroring backend schemas (app/schemas.py, app/models.py) */

export type AccountRole = "user" | "moderator" | "admin"
export type ModerationStatus = "pending" | "approved" | "rejected"

export interface AccountRead {
  id: number
  username: string
  role: AccountRole
  questions_posted: number
  score: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AccountCreate {
  username: string
  password?: string | null
  role?: AccountRole
}

export interface AccountUpdate {
  role?: AccountRole | null
  score?: number | null
  is_active?: boolean | null
  password?: string | null
}

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

export interface ProblemSourceLinkRead {
  note: string | null
  is_primary: boolean
  source: SourceRead
}

export interface ProblemDiagramRead {
  id: number
  image_path: string
  caption: string | null
  created_at: string
  updated_at: string
}

export interface SolutionRead {
  id: number
  body_text: string
  body_latex: string | null
  notes: string | null
  submitted_by: string | null
  moderation_status: ModerationStatus
  created_at: string
  updated_at: string
}

export interface SolutionCreate {
  body_text: string
  body_latex?: string | null
  notes?: string | null
  submitted_by?: string | null
  moderation_status?: ModerationStatus
}

export interface ProblemRead {
  id: number
  statement_text: string
  statement_latex: string | null
  content_markdown: string | null
  notes: string | null
  author: AccountRead | null
  submitted_by: string | null
  moderation_status: ModerationStatus
  created_at: string
  updated_at: string
  tags: TagRead[]
  sources: ProblemSourceLinkRead[]
  solutions: SolutionRead[]
  diagrams: ProblemDiagramRead[]
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
  moderation_status?: ModerationStatus
  tag_ids?: number[]
  sources?: ProblemSourceLinkCreate[]
}

export interface ProblemUpdate {
  statement_text?: string | null
  statement_latex?: string | null
  content_markdown?: string | null
  notes?: string | null
  moderation_status?: ModerationStatus | null
  tag_ids?: number[] | null
  sources?: ProblemSourceLinkCreate[] | null
}

export interface ProblemModerationUpdate {
  moderation_status: ModerationStatus
  canonical_source_id?: number | null
}

export interface DiagramUploadResponse {
  id: number
  image_path: string
  caption: string | null
}

export interface EditorAssetUploadResponse {
  image_path: string
  image_url: string
  markdown_image: string
}

export interface OcrLatexResponse {
  latex: string
  markdown?: string | null
  mode_used: string
  strategy: string
}

export interface OcrTextResponse {
  text: string
  strategy: string
}

export interface HealthResponse {
  status: string
  service?: string
}
