import { useAuth } from "@/contexts";
import { Navigate, Outlet } from "react-router";

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}

/** Gate for dashboard routes: must be signed in. */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/signin" replace />;
  return <Outlet />;
}

/** Gate for auth pages: redirect away if already signed in. */
export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
