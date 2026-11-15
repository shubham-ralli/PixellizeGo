import { useAuth } from "@/contexts";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

/** Performs logout on mount, then redirects to sign-in. */
export default function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void (async () => {
      try {
        await logout();
      } finally {
        navigate("/signin", { replace: true });
      }
    })();
  }, [logout, navigate]);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      Signing out…
    </div>
  );
}
