/** Canvas text wrapping with a visible ellipsis whenever content is omitted. */
export function wrapLines(value: string, maxWidth: number, maxLines: number, measure: (text: string) => number): string[] {
  if (maxWidth <= 0 || maxLines < 1 || !value.trim()) return [];
  const ellipsis = "…";
  if (measure(ellipsis) > maxWidth) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of value.trim().split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (measure(next) <= maxWidth) { line = next; continue; }
    if (line) { lines.push(line); line = ""; }
    for (const char of Array.from(word)) {
      if (measure(line + char) > maxWidth) {
        if (line) lines.push(line);
        line = "";
        if (measure(char) > maxWidth) { lines.push(ellipsis); continue; }
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = Array.from(visible[maxLines - 1]);
  while (last.length && measure(last.join("").trimEnd() + ellipsis) > maxWidth) last.pop();
  visible[maxLines - 1] = last.join("").trimEnd() + ellipsis;
  return visible;
}
