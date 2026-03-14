function buildQueryString(query) {
  const entries = Object.entries(query || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (!entries.length) {
    return "";
  }
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.set(key, String(value));
  }
  return `?${params.toString()}`;
}

function toApiUrl(baseUrl, path, query) {
  const normalizedBase = baseUrl.trim().replace(/\/$/, "");
  return `${normalizedBase}${path}${buildQueryString(query)}`;
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

function assertOk(response, payload, fallbackMessage) {
  if (response.ok) {
    return;
  }
  const detail = payload?.detail;
  if (typeof detail === "string" && detail.trim()) {
    throw new Error(detail);
  }
  throw new Error(fallbackMessage);
}

export async function requestSnippetOcr(baseUrl, file, ocrConfig) {
  const form = new FormData();
  form.append("file", file);
  form.append("ocr_mode", ocrConfig.mode);
  form.append("ocr_engine", ocrConfig.engine);
  form.append("ocr_server_type", ocrConfig.serverType);
  form.append("ocr_language", ocrConfig.language);
  form.append(
    "strip_math_delimiters",
    ocrConfig.stripMathDelimiters ? "true" : "false"
  );

  const response = await fetch(toApiUrl(baseUrl, "/problems/ocr-latex"), {
    method: "POST",
    body: form,
  });
  const payload = await parseJsonSafe(response);
  assertOk(response, payload, "OCR request failed");
  return payload;
}

export async function requestSnippetTextOcr(baseUrl, file, ocrConfig) {
  const form = new FormData();
  form.append("file", file);
  form.append("ocr_engine", ocrConfig.engine);
  form.append("ocr_server_type", ocrConfig.serverType);
  form.append("ocr_language", ocrConfig.language);
  form.append("text_tool", ocrConfig.textTool);
  form.append("strip_cjk", ocrConfig.stripCjk ? "true" : "false");

  const response = await fetch(toApiUrl(baseUrl, "/problems/ocr-text"), {
    method: "POST",
    body: form,
  });
  const payload = await parseJsonSafe(response);
  assertOk(response, payload, "Text OCR request failed");
  return payload;
}

export async function uploadSnippetAsset(baseUrl, blob, filename, altText) {
  const form = new FormData();
  const file = new File([blob], filename, { type: "image/png" });
  form.append("file", file);
  if (altText.trim()) {
    form.append("alt_text", altText.trim());
  }

  const response = await fetch(toApiUrl(baseUrl, "/problems/assets"), {
    method: "POST",
    body: form,
  });
  const payload = await parseJsonSafe(response);
  assertOk(response, payload, "Snippet image upload failed");
  return payload;
}

export async function createProblemDocument(baseUrl, payload, actorUserId) {
  const response = await fetch(
    toApiUrl(baseUrl, "/problems", {
      actor_user_id: actorUserId || undefined,
    }),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const responsePayload = await parseJsonSafe(response);
  assertOk(response, responsePayload, "Problem creation failed");
  return responsePayload;
}

export async function listProblems(baseUrl) {
  const response = await fetch(toApiUrl(baseUrl, "/problems"));
  const payload = await parseJsonSafe(response);
  assertOk(response, payload, "Problem list request failed");
  return payload;
}

export async function getProblem(baseUrl, problemId) {
  const response = await fetch(toApiUrl(baseUrl, `/problems/${problemId}`));
  const payload = await parseJsonSafe(response);
  assertOk(response, payload, "Problem fetch failed");
  return payload;
}

export async function updateProblem(baseUrl, problemId, payload, actorUserId) {
  const response = await fetch(
    toApiUrl(baseUrl, `/problems/${problemId}`, {
      actor_user_id: actorUserId || undefined,
    }),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const responsePayload = await parseJsonSafe(response);
  assertOk(response, responsePayload, "Problem update failed");
  return responsePayload;
}

export async function moderateProblem(baseUrl, problemId, payload, actorUserId) {
  const response = await fetch(
    toApiUrl(baseUrl, `/problems/${problemId}/moderation`, {
      actor_user_id: actorUserId || undefined,
    }),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const responsePayload = await parseJsonSafe(response);
  assertOk(response, responsePayload, "Problem moderation failed");
  return responsePayload;
}

export async function getSimilarProblems(baseUrl, problemId) {
  const response = await fetch(toApiUrl(baseUrl, `/problems/${problemId}/similar`));
  const payload = await parseJsonSafe(response);
  assertOk(response, payload, "Similar problems request failed");
  return payload;
}

export async function listTags(baseUrl) {
  const response = await fetch(toApiUrl(baseUrl, "/tags"));
  const payload = await parseJsonSafe(response);
  assertOk(response, payload, "Tag list request failed");
  return payload;
}

export async function createTag(baseUrl, payload) {
  const response = await fetch(toApiUrl(baseUrl, "/tags"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const responsePayload = await parseJsonSafe(response);
  assertOk(response, responsePayload, "Tag creation failed");
  return responsePayload;
}

export async function listAccounts(baseUrl, actorUserId) {
  const response = await fetch(
    toApiUrl(baseUrl, "/accounts", {
      actor_user_id: actorUserId || undefined,
    })
  );
  const payload = await parseJsonSafe(response);
  assertOk(response, payload, "Account list request failed");
  return payload;
}

export async function updateAccount(baseUrl, accountId, payload, actorUserId) {
  const response = await fetch(
    toApiUrl(baseUrl, `/accounts/${accountId}`, {
      actor_user_id: actorUserId || undefined,
    }),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  const responsePayload = await parseJsonSafe(response);
  assertOk(response, responsePayload, "Account update failed");
  return responsePayload;
}
