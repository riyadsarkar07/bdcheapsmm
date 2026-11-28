/** Read only explicit button labels from the same table row as the provider ID. */
export function publicRefillButtons(html: string): Record<string,boolean> {
  const buttons: Record<string,boolean> = {};
  const conflicting = new Set<string>();
  for (const [row] of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const id = row.match(/data-filter-table-service-id=["'](\d+)["']/i)?.[1];
    if (!id || conflicting.has(id)) continue;
    const text = row.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/\s+/g," ");
    const labels = Array.from(text.matchAll(/\bRefill Button\s*:\s*(Not Active|Inactive|Active)\b/gi), m => m[1].toLowerCase() === "active");
    if (!labels.length) continue;
    if (labels.some(label => label !== labels[0]) || (id in buttons && buttons[id] !== labels[0])) {
      delete buttons[id];
      conflicting.add(id);
    } else buttons[id] = labels[0];
  }
  return buttons;
}
