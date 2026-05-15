export function slugify(value: string, maxLength = 80): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (slug.slice(0, maxLength).replace(/-+$/g, "") || "claude-chat");
}
