import { uid } from "./editor-utils.js";

export const BLOCK_TYPES = {
  TEXT: "text",
  SNIPPET: "snippet",
  IMAGE: "image",
};

export function createTextBlock(initialText = "") {
  return {
    id: uid("block"),
    type: BLOCK_TYPES.TEXT,
    text: initialText,
  };
}

export function createSnippetBlock(snippetId) {
  return {
    id: uid("block"),
    type: BLOCK_TYPES.SNIPPET,
    snippetId,
  };
}

export function createImageBlock(snippetId) {
  return {
    id: uid("block"),
    type: BLOCK_TYPES.IMAGE,
    snippetId,
  };
}

export function updateTextBlock(blocks, blockId, text) {
  return blocks.map((block) =>
    block.id === blockId && block.type === BLOCK_TYPES.TEXT
      ? { ...block, text }
      : block
  );
}

export function removeBlock(blocks, blockId) {
  return blocks.filter((block) => block.id !== blockId);
}

export function insertBlockAfter(blocks, targetBlockId, newBlock) {
  if (!targetBlockId) {
    return [...blocks, newBlock];
  }
  const index = blocks.findIndex((block) => block.id === targetBlockId);
  if (index < 0) {
    return [...blocks, newBlock];
  }
  const next = [...blocks];
  next.splice(index + 1, 0, newBlock);
  return next;
}

export function reorderBlocks(blocks, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= blocks.length ||
    toIndex >= blocks.length ||
    fromIndex === toIndex
  ) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function findBlockById(blocks, blockId) {
  return blocks.find((block) => block.id === blockId) || null;
}
