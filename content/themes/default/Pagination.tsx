import type { Pagination as PaginationData } from "@theme-api";

function url(p: PaginationData, n: number): string {
  const qs = [p.query, `page=${n}`].filter(Boolean).join("&");
  return `${p.baseUrl}?${qs}`;
}

/** Windowed page numbers around the current page (±2), with first/last. */
function pageNumbers(current: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const add = (n: number) => out.push(n);
  const from = Math.max(2, current - 2);
  const to = Math.min(total - 1, current + 2);
  add(1);
  if (from > 2) out.push("…");
  for (let n = from; n <= to; n++) add(n);
  if (to < total - 1) out.push("…");
  if (total > 1) add(total);
  return out;
}

export function Pagination({ data }: { data: PaginationData }) {
  const { page, totalPages } = data;
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? (
        <a className="pagination__link" href={url(data, page - 1)} rel="prev">
          ← Prev
        </a>
      ) : (
        <span className="pagination__link pagination__link--off">← Prev</span>
      )}

      {pageNumbers(page, totalPages).map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="pagination__gap">
            …
          </span>
        ) : n === page ? (
          <span key={n} className="pagination__link pagination__link--current" aria-current="page">
            {n}
          </span>
        ) : (
          <a key={n} className="pagination__link" href={url(data, n)}>
            {n}
          </a>
        ),
      )}

      {page < totalPages ? (
        <a className="pagination__link" href={url(data, page + 1)} rel="next">
          Next →
        </a>
      ) : (
        <span className="pagination__link pagination__link--off">Next →</span>
      )}
    </nav>
  );
}
