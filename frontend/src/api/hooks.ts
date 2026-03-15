import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type {
  AccountCreate,
  AccountUpdate,
  ProblemCreate,
  ProblemUpdate,
  SolutionCreate,
  SourceCreate,
  TagCreate,
} from "@/types/api"
import type { ProblemsFilter } from "./client"
import * as api from "./client"

// Query keys
export const queryKeys = {
  health: ["health"] as const,
  accounts: ["accounts"] as const,
  account: (id: number) => ["accounts", id] as const,
  tags: ["tags"] as const,
  sources: ["sources"] as const,
  problems: ["problems"] as const,
  problem: (id: number) => ["problems", id] as const,
  similarProblems: (id: number) => ["problems", id, "similar"] as const,
}

// --- Health ---
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.getHealth(),
  })
}

// --- Accounts ---
export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AccountCreate) => api.createAccount(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts })
    },
  })
}

export function useAccounts(actorId: number | null) {
  return useQuery({
    queryKey: [...queryKeys.accounts, actorId],
    queryFn: () => api.listAccounts(),
    enabled: actorId != null,
  })
}

export function useAccount(accountId: number | null) {
  return useQuery({
    queryKey: queryKeys.account(accountId!),
    queryFn: () => api.getAccount(accountId!),
    enabled: accountId != null,
  })
}

export function useUpdateAccount(accountId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AccountUpdate) =>
      api.updateAccount(accountId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts })
      qc.invalidateQueries({ queryKey: queryKeys.account(accountId) })
    },
  })
}

// Login: uses backend POST /accounts/login (see client.login)
export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { username: string; password: string }) =>
      api.login(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.accounts })
    },
  })
}

// --- Tags ---
export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => api.listTags(),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TagCreate) => api.createTag(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tags })
      qc.invalidateQueries({ queryKey: queryKeys.problems })
    },
  })
}

// --- Sources ---
export function useSources() {
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: () => api.listSources(),
  })
}

export function useCreateSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SourceCreate) => api.createSource(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sources })
      qc.invalidateQueries({ queryKey: queryKeys.problems })
    },
  })
}

// --- Problems ---
export function useProblems(filters?: ProblemsFilter) {
  const normalized = filters
    ? {
        search: filters.search?.trim() || undefined,
        tag_ids: filters.tag_ids?.length ? filters.tag_ids : undefined,
        source_ids: filters.source_ids?.length ? filters.source_ids : undefined,
        sort: filters.sort || undefined,
      }
    : undefined
  return useQuery({
    queryKey: [...queryKeys.problems, normalized ?? {}],
    queryFn: () => api.listProblems(normalized ?? undefined),
  })
}

export function useProblem(problemId: number | null) {
  return useQuery({
    queryKey: queryKeys.problem(problemId!),
    queryFn: () => api.getProblem(problemId!),
    enabled: problemId != null,
  })
}

export function useCreateProblem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProblemCreate) => api.createProblem(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.problems })
    },
  })
}

export function useUpdateProblem(problemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProblemUpdate) =>
      api.updateProblem(problemId, payload),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.problem(problemId), data)
      qc.invalidateQueries({ queryKey: queryKeys.problems })
    },
  })
}

export function useSimilarProblems(problemId: number | null) {
  return useQuery({
    queryKey: queryKeys.similarProblems(problemId!),
    queryFn: () => api.getSimilarProblems(problemId!),
    enabled: problemId != null,
  })
}

export function useCreateSolution(problemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SolutionCreate) =>
      api.createSolution(problemId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.problems })
      qc.invalidateQueries({ queryKey: queryKeys.problem(problemId) })
    },
  })
}

export function useUploadProblemDiagram(problemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      file,
      caption,
    }: {
      file: File
      caption?: string | null
    }) => api.uploadProblemDiagram(problemId, file, caption),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.problem(problemId) })
      qc.invalidateQueries({ queryKey: queryKeys.problems })
    },
  })
}

export function useUploadEditorAsset() {
  return useMutation({
    mutationFn: ({
      file,
      altText,
    }: {
      file: File
      altText?: string | null
    }) => api.uploadEditorAsset(file, altText),
  })
}

export function useOcrLatex() {
  return useMutation({
    mutationFn: ({
      file,
      options,
    }: {
      file: File
      options?: import("./client").OcrLatexOptions
    }) => api.ocrLatex(file, options),
  })
}

export function useOcrText() {
  return useMutation({
    mutationFn: ({
      file,
      options,
    }: {
      file: File
      options?: import("./client").OcrTextOptions
    }) => api.ocrText(file, options),
  })
}
