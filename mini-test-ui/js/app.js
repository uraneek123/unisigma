import {
  buildMarkdownWithMathHtml,
  mapCanvasRectToImageRect,
  normalizeSelectionRect,
  uid,
} from "./editor-utils.js";
import {
  BLOCK_TYPES,
  createImageBlock,
  createSnippetBlock,
  createTextBlock,
  removeBlock,
  reorderBlocks,
  updateTextBlock,
} from "./composer-store.js";
import {
  createProblemDocument,
  createTag,
  getProblem,
  getSimilarProblems,
  listAccounts,
  listProblems,
  listTags,
  moderateProblem,
  requestSnippetOcr,
  requestSnippetTextOcr,
  updateAccount,
  updateProblem,
  uploadSnippetAsset,
} from "./api-client.js";

const $ = (id) => document.getElementById(id);

const dom = {
  apiBase: $("apiBase"),
  actorUserId: $("actorUserId"),
  submittedBy: $("submittedBy"),
  problemTitle: $("problemTitle"),
  workedDescription: $("workedDescription"),
  navViewPage: $("navViewPage"),
  navCreatePage: $("navCreatePage"),
  navAdminPage: $("navAdminPage"),
  pageView: $("pageView"),
  pageCreate: $("pageCreate"),
  pageAdmin: $("pageAdmin"),
  viewSearch: $("viewSearch"),
  viewTagFilter: $("viewTagFilter"),
  viewRefreshBtn: $("viewRefreshBtn"),
  viewProblemList: $("viewProblemList"),
  viewProblemSummary: $("viewProblemSummary"),
  viewLoadSimilarBtn: $("viewLoadSimilarBtn"),
  viewSimilarLimit: $("viewSimilarLimit"),
  viewProblemPreview: $("viewProblemPreview"),
  viewSimilarList: $("viewSimilarList"),
  sourceImageFiles: $("sourceImageFiles"),
  sourceList: $("sourceList"),
  sourceCanvas: $("sourceCanvas"),
  selectionMeta: $("selectionMeta"),
  captureSnippetBtn: $("captureSnippetBtn"),
  addTextBlockBtn: $("addTextBlockBtn"),
  clearBlocksBtn: $("clearBlocksBtn"),
  submitProblemBtn: $("submitProblemBtn"),
  blockList: $("blockList"),
  snippetList: $("snippetList"),
  ocrDefaultTool: $("ocrDefaultTool"),
  ocrDefaultMode: $("ocrDefaultMode"),
  ocrDefaultEngine: $("ocrDefaultEngine"),
  ocrDefaultServerType: $("ocrDefaultServerType"),
  ocrDefaultLanguage: $("ocrDefaultLanguage"),
  ocrDefaultTextTool: $("ocrDefaultTextTool"),
  ocrDefaultStripMath: $("ocrDefaultStripMath"),
  ocrDefaultStripCjk: $("ocrDefaultStripCjk"),
  ocrDefaultRenderKind: $("ocrDefaultRenderKind"),
  previewPane: $("previewPane"),
  compiledMarkdown: $("compiledMarkdown"),
  adminProblemId: $("adminProblemId"),
  adminLoadProblemBtn: $("adminLoadProblemBtn"),
  adminUpdateProblemBtn: $("adminUpdateProblemBtn"),
  adminStatementText: $("adminStatementText"),
  adminNotes: $("adminNotes"),
  adminContentMarkdown: $("adminContentMarkdown"),
  adminTagIds: $("adminTagIds"),
  adminModerationStatus: $("adminModerationStatus"),
  adminLoadSimilarBtn: $("adminLoadSimilarBtn"),
  adminProblemPreview: $("adminProblemPreview"),
  adminSimilarList: $("adminSimilarList"),
  adminVerifyStatus: $("adminVerifyStatus"),
  adminCanonicalSourceId: $("adminCanonicalSourceId"),
  adminVerifyBtn: $("adminVerifyBtn"),
  adminNewTagName: $("adminNewTagName"),
  adminNewTagDescription: $("adminNewTagDescription"),
  adminCreateTagBtn: $("adminCreateTagBtn"),
  adminRefreshTagsBtn: $("adminRefreshTagsBtn"),
  adminTagList: $("adminTagList"),
  adminRefreshAccountsBtn: $("adminRefreshAccountsBtn"),
  adminAccountId: $("adminAccountId"),
  adminUpdateAccountBtn: $("adminUpdateAccountBtn"),
  adminAccountRole: $("adminAccountRole"),
  adminAccountScore: $("adminAccountScore"),
  adminAccountIsActive: $("adminAccountIsActive"),
  adminAccountsList: $("adminAccountsList"),
  responseBox: $("responseBox"),
};

const ctx = dom.sourceCanvas.getContext("2d");
const textAreaByBlockId = new Map();

const state = {
  sources: [],
  activeSourceId: null,
  selectionRect: null,
  dragStartPoint: null,
  scaleX: 1,
  scaleY: 1,
  snippets: [],
  blocks: [createTextBlock("")],
  activeTextBlockId: null,
  dragBlockIndex: null,
  activePage: "view",
  problems: [],
  selectedViewProblemId: null,
  selectedAdminProblemId: null,
  tags: [],
  accounts: [],
};

const getApiBase = () => dom.apiBase.value.trim().replace(/\/$/, "");
const showResponse = (title, payload) => {
  dom.responseBox.textContent = `${title}\n\n${JSON.stringify(payload, null, 2)}`;
};
const getSnippetToken = (snippet) => `[${snippet.label}]`;
const getActorUserId = () => {
  const raw = dom.actorUserId.value.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error("Actor User ID must be a positive integer.");
  return n;
};

const getSnippetById = (snippetId) => state.snippets.find((s) => s.id === snippetId) || null;
const getSnippetByOrdinal = (n) => state.snippets.find((s) => s.ordinal === n) || null;
const getSourceById = (sourceId) => state.sources.find((s) => s.id === sourceId) || null;
const getActiveSource = () => getSourceById(state.activeSourceId);
const getProblemById = (problemId) => state.problems.find((p) => p.id === problemId) || null;

function upsertProblemInCache(problem) {
  const exists = state.problems.some((item) => item.id === problem.id);
  if (exists) {
    state.problems = state.problems.map((item) => (item.id === problem.id ? problem : item));
  } else {
    state.problems = [problem, ...state.problems];
  }
}

function setActivePage(pageKey) {
  state.activePage = pageKey;
  const isView = pageKey === "view";
  const isCreate = pageKey === "create";
  const isAdmin = pageKey === "admin";

  dom.pageView.classList.toggle("active", isView);
  dom.pageCreate.classList.toggle("active", isCreate);
  dom.pageAdmin.classList.toggle("active", isAdmin);
  dom.navViewPage.classList.toggle("active", isView);
  dom.navCreatePage.classList.toggle("active", isCreate);
  dom.navAdminPage.classList.toggle("active", isAdmin);
}

function requireActorUserId() {
  const actorUserId = getActorUserId();
  if (actorUserId === null) {
    throw new Error("Actor User ID is required for this action.");
  }
  return actorUserId;
}

function parseCsvIntegerList(raw) {
  if (!raw || !raw.trim()) return [];
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const values = tokens.map((token) => Number(token));
  if (values.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error("IDs must be positive integers (comma separated).");
  }
  return [...new Set(values)];
}

function defaultSnippetOcrConfig() {
  return {
    tool: dom.ocrDefaultTool.value,
    mode: dom.ocrDefaultMode.value,
    engine: dom.ocrDefaultEngine.value,
    serverType: dom.ocrDefaultServerType.value,
    language: dom.ocrDefaultLanguage.value.trim() || "English",
    textTool: dom.ocrDefaultTextTool.value,
    stripMathDelimiters: dom.ocrDefaultStripMath.value === "true",
    stripCjk: dom.ocrDefaultStripCjk.value === "true",
    renderKind: dom.ocrDefaultRenderKind.value,
    hasResult: false,
    content: "",
    status: "not_run",
    strategy: "",
  };
}

function normalizePlainText(rawText) {
  return (rawText || "")
    .replace(/\$\$?/g, "")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function snippetContent(snippet) {
  if (!snippet || !snippet.ocr.hasResult || !snippet.ocr.content.trim()) return snippet ? getSnippetToken(snippet) : "[snippet ?]";
  if (snippet.ocr.renderKind === "plain_text") return snippet.ocr.content;
  if (snippet.ocr.renderKind === "block_math") return `$$\n${snippet.ocr.content}\n$$`;
  return `$${snippet.ocr.content}$`;
}

function expandSnippetTokens(markdown) {
  return markdown.replace(/\[snippet\s+(\d+)\]/gi, (match, value) => {
    const snippet = getSnippetByOrdinal(Number(value));
    return snippet ? snippetContent(snippet) : match;
  });
}

function compileTokenMarkdown() {
  return state.blocks
    .map((block) => {
      if (block.type === BLOCK_TYPES.TEXT) return block.text.trim();
      const snippet = getSnippetById(block.snippetId);
      if (!snippet) return "";
      if (block.type === BLOCK_TYPES.SNIPPET) return getSnippetToken(snippet);
      return `[${snippet.label} image]`;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function compilePreviewMarkdown() {
  return state.blocks
    .map((block) => {
      if (block.type === BLOCK_TYPES.TEXT) return expandSnippetTokens(block.text || "").trim();
      const snippet = getSnippetById(block.snippetId);
      if (!snippet) return "";
      if (block.type === BLOCK_TYPES.SNIPPET) return snippetContent(snippet);
      return `![${snippet.label}](${snippet.previewUrl})`;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function renderPreview() {
  dom.compiledMarkdown.value = compileTokenMarkdown();
  const markdown = compilePreviewMarkdown();
  if (!markdown) {
    dom.previewPane.classList.add("muted");
    dom.previewPane.textContent = "No content yet.";
    return;
  }
  dom.previewPane.classList.remove("muted");
  dom.previewPane.innerHTML = buildMarkdownWithMathHtml(markdown, {
    markdownitFactory: window.markdownit,
    katex: window.katex,
  });
}

function problemPreviewMarkdown(problem) {
  if (problem.content_markdown && problem.content_markdown.trim()) {
    return problem.content_markdown;
  }
  if (problem.statement_latex && problem.statement_latex.trim()) {
    return `$$\n${problem.statement_latex.trim()}\n$$`;
  }
  return problem.statement_text || "";
}

function renderProblemPreview(target, problem) {
  const markdown = problemPreviewMarkdown(problem);
  if (!markdown.trim()) {
    target.classList.add("muted");
    target.textContent = "No renderable content.";
    return;
  }
  target.classList.remove("muted");
  target.innerHTML = buildMarkdownWithMathHtml(markdown, {
    markdownitFactory: window.markdownit,
    katex: window.katex,
  });
}

function problemSummaryText(problem) {
  const tags = (problem.tags || []).map((tag) => tag.name).join(", ") || "(none)";
  const author = problem.author?.username || problem.submitted_by || "(unknown)";
  return `#${problem.id} | ${problem.statement_text}\nstatus=${problem.moderation_status} | author=${author}\ntags=${tags}`;
}

function renderViewProblemSummary(problem) {
  if (!problem) {
    dom.viewProblemSummary.classList.add("muted");
    dom.viewProblemSummary.textContent = "Select a problem to inspect details.";
    dom.viewProblemPreview.classList.add("muted");
    dom.viewProblemPreview.textContent = "No problem selected.";
    return;
  }
  const tags = (problem.tags || []).map((tag) => tag.name).join(", ") || "(none)";
  const sources = (problem.sources || [])
    .map((sourceLink) => sourceLink.source?.title)
    .filter(Boolean)
    .join(", ") || "(none)";
  const author = problem.author?.username || problem.submitted_by || "(unknown)";
  dom.viewProblemSummary.classList.remove("muted");
  dom.viewProblemSummary.textContent = `#${problem.id} | ${problem.statement_text} | status=${problem.moderation_status} | author=${author} | tags=${tags} | sources=${sources}`;
  renderProblemPreview(dom.viewProblemPreview, problem);
}

function renderViewProblemList() {
  dom.viewProblemList.innerHTML = "";
  const search = dom.viewSearch.value.trim().toLowerCase();
  const tagFilter = dom.viewTagFilter.value.trim().toLowerCase();
  const filtered = state.problems.filter((problem) => {
    if (tagFilter) {
      const tagNames = (problem.tags || []).map((tag) => tag.name.toLowerCase());
      if (!tagNames.some((name) => name.includes(tagFilter))) return false;
    }
    if (!search) return true;
    const haystack = [
      problem.statement_text,
      problem.notes || "",
      problem.submitted_by || "",
      problem.author?.username || "",
      ...(problem.tags || []).map((tag) => tag.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });

  if (!filtered.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No problems match the current filters.";
    dom.viewProblemList.appendChild(p);
    return;
  }

  filtered.forEach((problem) => {
    const item = document.createElement("div");
    item.className = "problem-item";
    if (problem.id === state.selectedViewProblemId) item.classList.add("active");
    item.textContent = problemSummaryText(problem);
    item.addEventListener("click", () => {
      state.selectedViewProblemId = problem.id;
      renderViewProblemSummary(problem);
      renderViewProblemList();
    });
    dom.viewProblemList.appendChild(item);
  });
}

function renderSimilarList(target, problems) {
  target.innerHTML = "";
  if (!problems.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No similar problems found.";
    target.appendChild(p);
    return;
  }
  for (const problem of problems) {
    const item = document.createElement("div");
    item.className = "problem-item";
    item.textContent = problemSummaryText(problem);
    target.appendChild(item);
  }
}

async function refreshViewProblems() {
  const problems = await listProblems(getApiBase());
  state.problems = problems;
  if (state.selectedViewProblemId === null && problems.length) {
    state.selectedViewProblemId = problems[0].id;
  }
  if (state.selectedViewProblemId !== null) {
    renderViewProblemSummary(getProblemById(state.selectedViewProblemId));
  }
  renderViewProblemList();
  showResponse("View: problems loaded", { count: problems.length });
}

async function loadViewSimilar() {
  if (state.selectedViewProblemId === null) {
    throw new Error("Select a problem first.");
  }
  const limit = Number(dom.viewSimilarLimit.value);
  const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 5;
  const similar = await getSimilarProblems(getApiBase(), state.selectedViewProblemId);
  renderSimilarList(dom.viewSimilarList, similar.slice(0, maxItems));
  showResponse("View: similar loaded", {
    problem_id: state.selectedViewProblemId,
    count: similar.length,
  });
}

function renderAdminProblem(problem) {
  if (!problem) {
    dom.adminProblemPreview.classList.add("muted");
    dom.adminProblemPreview.textContent = "Load a problem to edit.";
    return;
  }
  dom.adminProblemId.value = String(problem.id);
  dom.adminStatementText.value = problem.statement_text || "";
  dom.adminNotes.value = problem.notes || "";
  dom.adminContentMarkdown.value = problem.content_markdown || "";
  dom.adminTagIds.value = (problem.tags || []).map((tag) => String(tag.id)).join(",");
  dom.adminModerationStatus.value = "";
  renderProblemPreview(dom.adminProblemPreview, problem);
}

function renderAdminDraftPreview() {
  const draft = {
    statement_text: dom.adminStatementText.value.trim() || "",
    statement_latex: null,
    content_markdown: dom.adminContentMarkdown.value,
  };
  renderProblemPreview(dom.adminProblemPreview, draft);
}

async function loadAdminProblem() {
  const problemId = Number(dom.adminProblemId.value);
  if (!Number.isInteger(problemId) || problemId <= 0) {
    throw new Error("Problem ID must be a positive integer.");
  }
  const problem = await getProblem(getApiBase(), problemId);
  state.selectedAdminProblemId = problem.id;
  renderAdminProblem(problem);
  showResponse("Admin: problem loaded", problem);
}

async function updateAdminProblem() {
  const problemId = state.selectedAdminProblemId || Number(dom.adminProblemId.value);
  if (!Number.isInteger(problemId) || problemId <= 0) {
    throw new Error("Load a problem first.");
  }
  const actorUserId = requireActorUserId();
  const payload = {
    statement_text: dom.adminStatementText.value.trim() || null,
    notes: dom.adminNotes.value.trim() || null,
    content_markdown: dom.adminContentMarkdown.value.trim() || null,
    tag_ids: parseCsvIntegerList(dom.adminTagIds.value),
  };
  if (dom.adminModerationStatus.value) {
    payload.moderation_status = dom.adminModerationStatus.value;
  }

  const updated = await updateProblem(getApiBase(), problemId, payload, actorUserId);
  state.selectedAdminProblemId = updated.id;
  renderAdminProblem(updated);
  upsertProblemInCache(updated);
  renderViewProblemList();
  if (state.selectedViewProblemId === updated.id) {
    renderViewProblemSummary(updated);
  }
  showResponse("Admin: problem updated", updated);
}

async function moderateAdminProblem() {
  const problemId = state.selectedAdminProblemId || Number(dom.adminProblemId.value);
  if (!Number.isInteger(problemId) || problemId <= 0) {
    throw new Error("Load a problem first.");
  }
  const actorUserId = requireActorUserId();
  const payload = { moderation_status: dom.adminVerifyStatus.value };
  const canonical = dom.adminCanonicalSourceId.value.trim();
  if (canonical) {
    const canonicalId = Number(canonical);
    if (!Number.isInteger(canonicalId) || canonicalId <= 0) {
      throw new Error("Canonical Source ID must be a positive integer.");
    }
    payload.canonical_source_id = canonicalId;
  }

  const updated = await moderateProblem(getApiBase(), problemId, payload, actorUserId);
  state.selectedAdminProblemId = updated.id;
  renderAdminProblem(updated);
  upsertProblemInCache(updated);
  renderViewProblemList();
  if (state.selectedViewProblemId === updated.id) {
    renderViewProblemSummary(updated);
  }
  showResponse("Admin: moderation applied", updated);
}

async function loadAdminSimilar() {
  const problemId = state.selectedAdminProblemId || Number(dom.adminProblemId.value);
  if (!Number.isInteger(problemId) || problemId <= 0) {
    throw new Error("Load a problem first.");
  }
  const similar = await getSimilarProblems(getApiBase(), problemId);
  renderSimilarList(dom.adminSimilarList, similar);
  showResponse("Admin: similar loaded", { problem_id: problemId, count: similar.length });
}

function renderTagList() {
  dom.adminTagList.innerHTML = "";
  if (!state.tags.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No tags found.";
    dom.adminTagList.appendChild(p);
    return;
  }
  for (const tag of state.tags) {
    const item = document.createElement("div");
    item.className = "tag-item";
    item.textContent = `#${tag.id} | ${tag.name}${tag.description ? ` | ${tag.description}` : ""}`;
    dom.adminTagList.appendChild(item);
  }
}

async function refreshTagsForAdmin() {
  const tags = await listTags(getApiBase());
  state.tags = tags;
  renderTagList();
  showResponse("Admin: tags loaded", { count: tags.length });
}

async function createAdminTag() {
  const name = dom.adminNewTagName.value.trim();
  if (!name) throw new Error("Tag name is required.");
  const payload = {
    name,
    description: dom.adminNewTagDescription.value.trim() || null,
  };
  const created = await createTag(getApiBase(), payload);
  dom.adminNewTagName.value = "";
  dom.adminNewTagDescription.value = "";
  await refreshTagsForAdmin();
  showResponse("Admin: tag created", created);
}

function renderAccounts() {
  dom.adminAccountsList.innerHTML = "";
  if (!state.accounts.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No accounts loaded.";
    dom.adminAccountsList.appendChild(p);
    return;
  }
  for (const account of state.accounts) {
    const item = document.createElement("div");
    item.className = "account-item";
    item.textContent = `#${account.id} | ${account.username} | role=${account.role} | score=${account.score} | active=${account.is_active}`;
    item.addEventListener("click", () => {
      dom.adminAccountId.value = String(account.id);
      dom.adminAccountRole.value = account.role;
      dom.adminAccountScore.value = String(account.score);
      dom.adminAccountIsActive.value = account.is_active ? "true" : "false";
    });
    dom.adminAccountsList.appendChild(item);
  }
}

async function refreshAccountsForAdmin() {
  const actorUserId = requireActorUserId();
  const accounts = await listAccounts(getApiBase(), actorUserId);
  state.accounts = accounts;
  renderAccounts();
  showResponse("Admin: accounts loaded", { count: accounts.length });
}

async function updateAdminAccount() {
  const accountId = Number(dom.adminAccountId.value);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error("Account ID must be a positive integer.");
  }
  const actorUserId = requireActorUserId();
  const payload = {};
  if (dom.adminAccountRole.value) payload.role = dom.adminAccountRole.value;
  if (dom.adminAccountScore.value.trim()) {
    const score = Number(dom.adminAccountScore.value);
    if (!Number.isInteger(score)) throw new Error("Score must be an integer.");
    payload.score = score;
  }
  if (dom.adminAccountIsActive.value) {
    payload.is_active = dom.adminAccountIsActive.value === "true";
  }
  if (!Object.keys(payload).length) {
    throw new Error("Provide at least one account field to update.");
  }
  const updated = await updateAccount(getApiBase(), accountId, payload, actorUserId);
  state.accounts = state.accounts.map((account) =>
    account.id === updated.id ? updated : account
  );
  renderAccounts();
  showResponse("Admin: account updated", updated);
}

function canvasPoint(event) {
  const rect = dom.sourceCanvas.getBoundingClientRect();
  const sx = dom.sourceCanvas.width / rect.width;
  const sy = dom.sourceCanvas.height / rect.height;
  return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy };
}

function renderSelectionMeta() {
  if (!state.selectionRect) {
    dom.selectionMeta.value = "No selection yet";
    return;
  }
  dom.selectionMeta.value = `${state.selectionRect.width}x${state.selectionRect.height} at (${state.selectionRect.x}, ${state.selectionRect.y})`;
}

function renderCanvas() {
  ctx.clearRect(0, 0, dom.sourceCanvas.width, dom.sourceCanvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, dom.sourceCanvas.width, dom.sourceCanvas.height);
  const source = getActiveSource();
  if (!source) {
    ctx.fillStyle = "#64748b";
    ctx.font = "16px sans-serif";
    ctx.fillText("Upload and select a source image.", 16, 30);
    return;
  }

  const scale = Math.min(1, 940 / source.width, 520 / source.height);
  dom.sourceCanvas.width = Math.max(1, Math.round(source.width * scale));
  dom.sourceCanvas.height = Math.max(1, Math.round(source.height * scale));
  state.scaleX = source.width / dom.sourceCanvas.width;
  state.scaleY = source.height / dom.sourceCanvas.height;
  ctx.drawImage(source.image, 0, 0, dom.sourceCanvas.width, dom.sourceCanvas.height);

  if (state.selectionRect) {
    ctx.save();
    ctx.strokeStyle = "#0369a1";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      state.selectionRect.x,
      state.selectionRect.y,
      state.selectionRect.width,
      state.selectionRect.height
    );
    ctx.restore();
  }
}

function renderSources() {
  dom.sourceList.innerHTML = "";
  if (!state.sources.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No source images uploaded.";
    dom.sourceList.appendChild(p);
    return;
  }
  state.sources.forEach((source) => {
    const item = document.createElement("div");
    item.className = "source-item";
    if (source.id === state.activeSourceId) item.classList.add("active");
    item.innerHTML = `<img src="${source.previewUrl}" alt="${source.name}" /><p class="muted">${source.name}</p>`;
    item.addEventListener("click", () => {
      state.activeSourceId = source.id;
      state.selectionRect = null;
      renderSelectionMeta();
      renderSources();
      renderCanvas();
    });
    dom.sourceList.appendChild(item);
  });
}

function insertTokenIntoActiveText(token) {
  const blockId = state.activeTextBlockId;
  const textArea = textAreaByBlockId.get(blockId);
  if (!blockId || !textArea) {
    state.blocks = [...state.blocks, createTextBlock(token)];
    renderBlocks();
    renderPreview();
    return;
  }
  const start = textArea.selectionStart ?? textArea.value.length;
  const end = textArea.selectionEnd ?? textArea.value.length;
  const next = `${textArea.value.slice(0, start)}${token}${textArea.value.slice(end)}`;
  textArea.value = next;
  textArea.focus();
  const cursor = start + token.length;
  textArea.setSelectionRange(cursor, cursor);
  state.blocks = updateTextBlock(state.blocks, blockId, next);
  renderPreview();
}

function renderBlocks() {
  dom.blockList.innerHTML = "";
  textAreaByBlockId.clear();
  state.blocks.forEach((block, index) => {
    const item = document.createElement("div");
    item.className = "block-item";
    item.draggable = true;
    item.addEventListener("dragstart", () => { state.dragBlockIndex = index; });
    item.addEventListener("dragover", (event) => { event.preventDefault(); item.classList.add("drag-over"); });
    item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      item.classList.remove("drag-over");
      if (state.dragBlockIndex === null) return;
      state.blocks = reorderBlocks(state.blocks, state.dragBlockIndex, index);
      state.dragBlockIndex = null;
      renderBlocks();
      renderPreview();
    });

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.justifyContent = "space-between";
    head.style.alignItems = "center";
    head.style.marginBottom = "6px";
    head.innerHTML = `<strong>Block ${index + 1} (${block.type})</strong><button style="width:auto;padding:6px 10px;background:#b91c1c;">Delete</button>`;
    head.querySelector("button").addEventListener("click", () => {
      state.blocks = removeBlock(state.blocks, block.id);
      if (!state.blocks.length) state.blocks = [createTextBlock("")];
      renderBlocks();
      renderPreview();
    });
    item.appendChild(head);

    if (block.type === BLOCK_TYPES.TEXT) {
      const textArea = document.createElement("textarea");
      textArea.value = block.text || "";
      textArea.placeholder = "Text block. Insert snippet tokens like [snippet 1].";
      textArea.addEventListener("focus", () => { state.activeTextBlockId = block.id; });
      textArea.addEventListener("input", () => {
        state.blocks = updateTextBlock(state.blocks, block.id, textArea.value);
        renderPreview();
      });
      textAreaByBlockId.set(block.id, textArea);
      item.appendChild(textArea);
    } else {
      const snippet = getSnippetById(block.snippetId);
      const token = snippet ? getSnippetToken(snippet) : "[missing snippet]";
      const tokenEl = document.createElement("div");
      tokenEl.className = "block-token";
      tokenEl.textContent = block.type === BLOCK_TYPES.SNIPPET ? token : `${token} image`;
      item.appendChild(tokenEl);
      if (snippet && block.type === BLOCK_TYPES.IMAGE) {
        const image = document.createElement("img");
        image.src = snippet.previewUrl;
        image.alt = snippet.label;
        image.style.width = "100%";
        image.style.maxHeight = "120px";
        image.style.objectFit = "contain";
        image.style.border = "1px solid var(--line)";
        image.style.borderRadius = "6px";
        image.style.marginTop = "8px";
        item.appendChild(image);
      }
    }
    dom.blockList.appendChild(item);
  });
}

async function runSnippetOcr(snippet) {
  snippet.ocr.status = "running";
  renderSnippets();
  try {
    const file = new File([snippet.blob], `${snippet.id}.png`, { type: "image/png" });
    let content = "";
    let strategy = "";
    if (snippet.ocr.tool === "text") {
      const textPayload = await requestSnippetTextOcr(getApiBase(), file, {
        engine: snippet.ocr.engine,
        serverType: snippet.ocr.serverType,
        language: snippet.ocr.language,
        textTool: snippet.ocr.textTool,
        stripCjk: snippet.ocr.stripCjk,
      });
      content = normalizePlainText(textPayload.text || "");
      strategy = textPayload.strategy || "";
      showResponse(`Text OCR ${snippet.label}`, textPayload);
    } else {
      const latexPayload = await requestSnippetOcr(getApiBase(), file, {
        mode: snippet.ocr.mode,
        engine: snippet.ocr.engine,
        serverType: snippet.ocr.serverType,
        language: snippet.ocr.language,
        stripMathDelimiters: snippet.ocr.stripMathDelimiters,
      });
      content = (latexPayload.latex || "").trim();
      if (snippet.ocr.renderKind === "plain_text") {
        content = normalizePlainText(
          latexPayload.markdown || latexPayload.latex || ""
        );
      }
      strategy = latexPayload.strategy || "";
      showResponse(`Math OCR ${snippet.label}`, latexPayload);
    }

    snippet.ocr.hasResult = Boolean(content);
    snippet.ocr.content = content;
    snippet.ocr.status = snippet.ocr.hasResult ? "ready" : "empty";
    snippet.ocr.strategy = strategy;
    renderSnippets();
    renderPreview();
  } catch (error) {
    snippet.ocr.status = "error";
    showResponse(`OCR ${snippet.label} failed`, { message: String(error) });
    renderSnippets();
  }
}

function renderSnippets() {
  dom.snippetList.innerHTML = "";
  if (!state.snippets.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Capture snippets to populate this list.";
    dom.snippetList.appendChild(p);
    return;
  }

  state.snippets.forEach((snippet) => {
    const item = document.createElement("div");
    item.className = "snippet-item";
    item.innerHTML = `<strong>${snippet.label}</strong> <span class="muted">(${snippet.sourceName})</span><img src="${snippet.previewUrl}" alt="${snippet.label}" /><p class="muted">Status: ${snippet.ocr.status} | tool: ${snippet.ocr.tool}${snippet.ocr.strategy ? ` | ${snippet.ocr.strategy}` : ""}</p>`;

    const kindRow = document.createElement("div");
    kindRow.className = "row3";
    kindRow.innerHTML = `<div><label>Snippet Kind</label><select data-f="kind"><option value="inline_math">inline_math</option><option value="block_math">block_math</option><option value="plain_text">plain_text</option></select></div><div><label>OCR Tool</label><select data-f="tool"><option value="math">math</option><option value="text">text</option></select></div><div style="display:flex;align-items:end;"><button class="btn-secondary">Run OCR</button></div>`;
    const kindSelect = kindRow.querySelector('select[data-f="kind"]');
    const toolSelect = kindRow.querySelector('select[data-f="tool"]');
    kindSelect.value = snippet.ocr.renderKind;
    kindSelect.addEventListener("change", () => { snippet.ocr.renderKind = kindSelect.value; renderPreview(); });
    toolSelect.value = snippet.ocr.tool;
    toolSelect.addEventListener("change", () => {
      snippet.ocr.tool = toolSelect.value;
      if (snippet.ocr.tool === "text" && snippet.ocr.renderKind !== "plain_text") {
        snippet.ocr.renderKind = "plain_text";
        kindSelect.value = "plain_text";
      }
    });
    kindRow.querySelector("button").addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      try { await runSnippetOcr(snippet); } finally { event.currentTarget.disabled = false; }
    });
    item.appendChild(kindRow);

    const actions = document.createElement("div");
    actions.className = "snippet-actions";
    actions.innerHTML = `<button>Insert Token</button><button>Add Token Block</button><button>Add Image Block</button><button style="background:#b91c1c;">Delete Snippet</button>`;
    const [insertBtn, addBlockBtn, addImageBtn, deleteBtn] = actions.querySelectorAll("button");
    insertBtn.addEventListener("click", () => insertTokenIntoActiveText(getSnippetToken(snippet)));
    addBlockBtn.addEventListener("click", () => { state.blocks = [...state.blocks, createSnippetBlock(snippet.id)]; renderBlocks(); renderPreview(); });
    addImageBtn.addEventListener("click", () => { state.blocks = [...state.blocks, createImageBlock(snippet.id)]; renderBlocks(); renderPreview(); });
    deleteBtn.addEventListener("click", () => {
      state.snippets = state.snippets.filter((s) => s.id !== snippet.id);
      state.blocks = state.blocks.filter((b) => b.snippetId !== snippet.id);
      URL.revokeObjectURL(snippet.previewUrl);
      renderSnippets();
      renderBlocks();
      renderPreview();
    });
    item.appendChild(actions);

    const contentDetails = document.createElement("details");
    contentDetails.innerHTML = `<summary>Snippet Content (editable)</summary><textarea data-f="content" rows="4" placeholder="OCR output can be edited here before using this snippet."></textarea>`;
    const content = contentDetails.querySelector('textarea[data-f="content"]');
    content.value = snippet.ocr.content || "";
    content.addEventListener("input", () => {
      snippet.ocr.content = content.value;
      snippet.ocr.hasResult = Boolean(content.value.trim());
      renderPreview();
    });
    item.appendChild(contentDetails);

    const details = document.createElement("details");
    details.innerHTML = `
      <summary>OCR Options</summary>
      <div class="row">
        <div>
          <label>Mode (math tool)</label>
          <select data-f="mode">
            <option value="formula">formula</option>
            <option value="text_formula">text_formula</option>
            <option value="page">page</option>
            <option value="auto">auto</option>
          </select>
        </div>
        <div>
          <label>Engine</label>
          <select data-f="engine">
            <option value="default">default</option>
            <option value="local">local</option>
            <option value="cloud">cloud</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-top:6px;">
        <div>
          <label>Server Type</label>
          <select data-f="serverType">
            <option value="pro">pro</option>
            <option value="plus">plus</option>
            <option value="ultra">ultra</option>
          </select>
        </div>
        <div>
          <label>Language</label>
          <input data-f="language" />
        </div>
      </div>
      <div class="row" style="margin-top:6px;">
        <div>
          <label>Text Backend</label>
          <select data-f="textTool">
            <option value="auto">auto</option>
            <option value="tesseract">tesseract</option>
            <option value="pix2text">pix2text</option>
          </select>
        </div>
        <div>
          <label>Strip CJK</label>
          <select data-f="stripCjk">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-top:6px;">
        <div>
          <label>Strip Delimiters (math tool)</label>
          <select data-f="strip">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      </div>
    `;

    const mode = details.querySelector('select[data-f="mode"]');
    const engine = details.querySelector('select[data-f="engine"]');
    const serverType = details.querySelector('select[data-f="serverType"]');
    const language = details.querySelector('input[data-f="language"]');
    const textTool = details.querySelector('select[data-f="textTool"]');
    const stripCjk = details.querySelector('select[data-f="stripCjk"]');
    const strip = details.querySelector('select[data-f="strip"]');
    mode.value = snippet.ocr.mode;
    engine.value = snippet.ocr.engine;
    serverType.value = snippet.ocr.serverType;
    language.value = snippet.ocr.language;
    textTool.value = snippet.ocr.textTool;
    stripCjk.value = snippet.ocr.stripCjk ? "true" : "false";
    strip.value = snippet.ocr.stripMathDelimiters ? "true" : "false";
    mode.addEventListener("change", () => { snippet.ocr.mode = mode.value; });
    engine.addEventListener("change", () => { snippet.ocr.engine = engine.value; });
    serverType.addEventListener("change", () => { snippet.ocr.serverType = serverType.value; });
    language.addEventListener("input", () => { snippet.ocr.language = language.value.trim() || "English"; });
    textTool.addEventListener("change", () => { snippet.ocr.textTool = textTool.value; });
    stripCjk.addEventListener("change", () => { snippet.ocr.stripCjk = stripCjk.value === "true"; });
    strip.addEventListener("change", () => { snippet.ocr.stripMathDelimiters = strip.value === "true"; });
    item.appendChild(details);

    dom.snippetList.appendChild(item);
  });
}

async function captureSnippet() {
  const source = getActiveSource();
  if (!source) return showResponse("Validation", { message: "Select a source image first." });
  if (!state.selectionRect) return showResponse("Validation", { message: "Draw a selection rectangle first." });
  const rect = mapCanvasRectToImageRect(state.selectionRect, state.scaleX, state.scaleY);
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const c = canvas.getContext("2d");
  c.drawImage(source.image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Failed to create snippet blob"))), "image/png");
  });
  const ordinal = state.snippets.length + 1;
  const snippet = {
    id: uid("snippet"),
    ordinal,
    label: `snippet ${ordinal}`,
    sourceId: source.id,
    sourceName: source.name,
    blob,
    previewUrl: URL.createObjectURL(blob),
    ocr: defaultSnippetOcrConfig(),
  };
  state.snippets = [...state.snippets, snippet];
  renderSnippets();
  renderPreview();
  showResponse("Snippet captured", { snippet: snippet.label, source: source.name, rect });
}

async function submitProblem() {
  const title = dom.problemTitle.value.trim();
  const description = dom.workedDescription.value.trim();
  const submittedBy = dom.submittedBy.value.trim();
  const actorUserId = getActorUserId();

  let tokenMarkdown = compileTokenMarkdown();
  if (!title && !tokenMarkdown) {
    showResponse("Validation", { message: "Need a title or block content before submit." });
    return;
  }

  const imageIds = [...new Set(state.blocks.filter((b) => b.type === BLOCK_TYPES.IMAGE).map((b) => b.snippetId).filter(Boolean))];
  const uploadedImageMarkdown = new Map();
  for (const snippetId of imageIds) {
    const snippet = getSnippetById(snippetId);
    if (!snippet) continue;
    const uploaded = await uploadSnippetAsset(getApiBase(), snippet.blob, `${snippet.id}.png`, snippet.label);
    uploadedImageMarkdown.set(snippet.id, uploaded.markdown_image);
  }

  const lines = state.blocks.map((block) => {
    if (block.type === BLOCK_TYPES.TEXT) return block.text.trim();
    const snippet = getSnippetById(block.snippetId);
    if (!snippet) return "";
    if (block.type === BLOCK_TYPES.SNIPPET) return getSnippetToken(snippet);
    return uploadedImageMarkdown.get(snippet.id) || getSnippetToken(snippet);
  }).filter(Boolean);
  tokenMarkdown = lines.join("\n\n").trim();

  const manifest = state.snippets.map((snippet) => ({
    token: getSnippetToken(snippet),
    render_kind: snippet.ocr.renderKind,
    ocr_mode: snippet.ocr.mode,
    ocr_engine: snippet.ocr.engine,
    has_ocr: snippet.ocr.hasResult,
    strategy: snippet.ocr.strategy || null,
  }));

  const payload = {
    statement_text: title || null,
    content_markdown: `${tokenMarkdown}\n\n<!-- unisigma-snippets: ${JSON.stringify(manifest)} -->`,
    notes: description || null,
    submitted_by: submittedBy || null,
    auto_generate_latex: false,
    suggested_tag_names: [],
    suggested_sources: [],
    tag_ids: [],
    sources: [],
  };
  const result = await createProblemDocument(getApiBase(), payload, actorUserId);
  upsertProblemInCache(result);
  state.selectedViewProblemId = result.id;
  renderViewProblemList();
  renderViewProblemSummary(result);
  showResponse("Problem submitted", result);
}

async function runAction(actionName, fn) {
  try {
    await fn();
  } catch (error) {
    showResponse(`${actionName} failed`, { message: String(error) });
  }
}

dom.navViewPage.addEventListener("click", () => setActivePage("view"));
dom.navCreatePage.addEventListener("click", () => setActivePage("create"));
dom.navAdminPage.addEventListener("click", () => setActivePage("admin"));

dom.viewSearch.addEventListener("input", renderViewProblemList);
dom.viewTagFilter.addEventListener("input", renderViewProblemList);
dom.viewRefreshBtn.addEventListener("click", async () => {
  dom.viewRefreshBtn.disabled = true;
  await runAction("View refresh", refreshViewProblems);
  dom.viewRefreshBtn.disabled = false;
});
dom.viewLoadSimilarBtn.addEventListener("click", async () => {
  dom.viewLoadSimilarBtn.disabled = true;
  await runAction("Load similar", loadViewSimilar);
  dom.viewLoadSimilarBtn.disabled = false;
});

dom.adminLoadProblemBtn.addEventListener("click", async () => {
  dom.adminLoadProblemBtn.disabled = true;
  await runAction("Load admin problem", loadAdminProblem);
  dom.adminLoadProblemBtn.disabled = false;
});
dom.adminUpdateProblemBtn.addEventListener("click", async () => {
  dom.adminUpdateProblemBtn.disabled = true;
  await runAction("Update problem", updateAdminProblem);
  dom.adminUpdateProblemBtn.disabled = false;
});
dom.adminVerifyBtn.addEventListener("click", async () => {
  dom.adminVerifyBtn.disabled = true;
  await runAction("Moderation action", moderateAdminProblem);
  dom.adminVerifyBtn.disabled = false;
});
dom.adminLoadSimilarBtn.addEventListener("click", async () => {
  dom.adminLoadSimilarBtn.disabled = true;
  await runAction("Admin similar", loadAdminSimilar);
  dom.adminLoadSimilarBtn.disabled = false;
});
dom.adminCreateTagBtn.addEventListener("click", async () => {
  dom.adminCreateTagBtn.disabled = true;
  await runAction("Create tag", createAdminTag);
  dom.adminCreateTagBtn.disabled = false;
});
dom.adminRefreshTagsBtn.addEventListener("click", async () => {
  dom.adminRefreshTagsBtn.disabled = true;
  await runAction("Refresh tags", refreshTagsForAdmin);
  dom.adminRefreshTagsBtn.disabled = false;
});
dom.adminRefreshAccountsBtn.addEventListener("click", async () => {
  dom.adminRefreshAccountsBtn.disabled = true;
  await runAction("Refresh accounts", refreshAccountsForAdmin);
  dom.adminRefreshAccountsBtn.disabled = false;
});
dom.adminUpdateAccountBtn.addEventListener("click", async () => {
  dom.adminUpdateAccountBtn.disabled = true;
  await runAction("Update account", updateAdminAccount);
  dom.adminUpdateAccountBtn.disabled = false;
});
dom.adminStatementText.addEventListener("input", renderAdminDraftPreview);
dom.adminContentMarkdown.addEventListener("input", renderAdminDraftPreview);

dom.sourceImageFiles.addEventListener("change", async () => {
  const files = Array.from(dom.sourceImageFiles.files || []);
  if (!files.length) return;
  try {
    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = previewUrl;
      });
      state.sources = [...state.sources, { id: uid("source"), name: file.name, previewUrl, image, width: image.naturalWidth, height: image.naturalHeight }];
    }
    if (!state.activeSourceId && state.sources.length) state.activeSourceId = state.sources[0].id;
    state.selectionRect = null;
    renderSelectionMeta();
    renderSources();
    renderCanvas();
  } catch (error) {
    showResponse("Source upload failed", { message: String(error) });
  } finally {
    dom.sourceImageFiles.value = "";
  }
});

dom.sourceCanvas.addEventListener("mousedown", (event) => {
  if (!getActiveSource()) return;
  state.dragStartPoint = canvasPoint(event);
});
dom.sourceCanvas.addEventListener("mousemove", (event) => {
  if (!state.dragStartPoint || !getActiveSource()) return;
  state.selectionRect = normalizeSelectionRect(state.dragStartPoint, canvasPoint(event), dom.sourceCanvas.width, dom.sourceCanvas.height);
  renderSelectionMeta();
  renderCanvas();
});
dom.sourceCanvas.addEventListener("mouseup", (event) => {
  if (!state.dragStartPoint || !getActiveSource()) return;
  state.selectionRect = normalizeSelectionRect(state.dragStartPoint, canvasPoint(event), dom.sourceCanvas.width, dom.sourceCanvas.height);
  state.dragStartPoint = null;
  renderSelectionMeta();
  renderCanvas();
});
dom.sourceCanvas.addEventListener("mouseleave", () => {
  if (!state.dragStartPoint) return;
  state.dragStartPoint = null;
  renderSelectionMeta();
  renderCanvas();
});

dom.captureSnippetBtn.addEventListener("click", async () => {
  try { await captureSnippet(); } catch (error) { showResponse("Snippet capture failed", { message: String(error) }); }
});
dom.addTextBlockBtn.addEventListener("click", () => {
  state.blocks = [...state.blocks, createTextBlock("")];
  renderBlocks();
  renderPreview();
});
dom.clearBlocksBtn.addEventListener("click", () => {
  state.blocks = [createTextBlock("")];
  state.activeTextBlockId = null;
  renderBlocks();
  renderPreview();
});
dom.submitProblemBtn.addEventListener("click", async () => {
  dom.submitProblemBtn.disabled = true;
  try { await submitProblem(); } catch (error) { showResponse("Submit failed", { message: String(error) }); }
  finally { dom.submitProblemBtn.disabled = false; }
});

renderSources();
renderSelectionMeta();
renderCanvas();
renderBlocks();
renderSnippets();
renderPreview();
setActivePage("view");
renderViewProblemSummary(null);
renderSimilarList(dom.viewSimilarList, []);
renderSimilarList(dom.adminSimilarList, []);
renderTagList();
renderAccounts();
window.addEventListener("load", async () => {
  renderPreview();
  await runAction("Initial problem load", refreshViewProblems);
  await runAction("Initial tag load", refreshTagsForAdmin);
});
