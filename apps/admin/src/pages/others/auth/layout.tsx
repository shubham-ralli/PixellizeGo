import { asset } from "@/utils/asset";
import GridShape from "@/components/shared/grid-shape";
import { Link, Outlet } from "react-router";
import ThemeToggler from "./theme-toggler";

export default function AuthLayout() {
  return (
    <div className="relative z-1 bg-white p-6 sm:p-0 dark:bg-gray-900">
      <div className="relative flex h-screen w-full flex-col justify-center sm:p-0 lg:flex-row dark:bg-gray-900">
        <Outlet />
        <div className="relative hidden h-full w-full items-center justify-center bg-brand-950 lg:grid lg:w-1/2 dark:bg-white/5">
          <div className="z-1 flex h-full items-center justify-center">
            <GridShape />

            <div className="flex max-w-xs flex-col items-center">
              <Link to="/" className="mb-4 flex items-center gap-3">
                <img src={asset("/favicon.png")} alt="PixellizeGo" className="size-12" />
                <span className="text-3xl font-bold text-white">PixellizeGo</span>
              </Link>
              <p className="text-center text-gray-400 dark:text-white/60">
                A modern self-hosted CMS
              </p>
            </div>
          </div>
        </div>

        <div className="fixed inset-e-6 bottom-6 z-50 hidden sm:block">
          <ThemeToggler />
        </div>
      </div>
    </div>
  );
}
