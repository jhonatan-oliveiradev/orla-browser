export function reorderTabs(entries, sourceId, targetId, after = false) {
  if (sourceId === targetId) return null;
  const from = entries.findIndex(([id]) => id === sourceId);
  const to = entries.findIndex(([id]) => id === targetId);
  if (from < 0 || to < 0 || entries[from][1].pinned !== entries[to][1].pinned) return null;

  const index = to + Number(after) - Number(from < to);
  if (index === from) return null;
  const reordered = [...entries];
  const [entry] = reordered.splice(from, 1);
  reordered.splice(index, 0, entry);
  return reordered;
}
