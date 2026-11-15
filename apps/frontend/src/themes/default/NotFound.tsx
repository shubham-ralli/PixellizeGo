export function NotFound() {
  return (
    <div className="notfound">
      <h1>404</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <a className="chip" href="/">
        Back to home
      </a>
    </div>
  );
}
