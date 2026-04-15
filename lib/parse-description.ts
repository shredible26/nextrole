export function parseDescription(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // JSON object wrapper e.g. {"description": "..."}
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const text =
        parsed.description ??
        parsed.text ??
        parsed.content ??
        parsed.body ??
        parsed.html ??
        Object.values(parsed)[0];
      if (typeof text === 'string') return text;
    } catch {}
  }

  // JSON array wrapper e.g. [{"name": "About", "value": "<p>...</p>"}, ...]
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: Record<string, unknown>) => {
            const content =
              (item.value as string) ??
              (item.text as string) ??
              (item.content as string) ??
              (item.description as string) ??
              (item.body as string) ??
              (item.html as string) ??
              '';
            const label =
              (item.name as string) ??
              (item.title as string) ??
              (item.header as string) ??
              '';
            return label ? `<h3>${label}</h3>${content}` : content;
          })
          .filter(Boolean)
          .join('\n\n');
      }
    } catch {}
  }

  return raw;
}
