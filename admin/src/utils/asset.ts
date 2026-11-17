/** Resolve a public asset path against the app's base URL (e.g. "/admin/"). */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
