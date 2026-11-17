import { SidebarHeader } from "@/components/ui/sidebar";
import { asset } from "@/utils/asset";
import { Link } from "react-router";

interface AppSidebarHeaderProps {
  showContent: boolean;
}

export default function AppSidebarHeader({ showContent }: AppSidebarHeaderProps) {
  return (
    <SidebarHeader className="px-5 py-8">
      <Link to="/" className="flex items-center gap-3">
        <img src={asset("/favicon.png")} alt="PixellizeGo" className="size-8 shrink-0" />
        {showContent && (
          <span className="text-xl font-bold text-gray-800 dark:text-white/90">PixellizeGo</span>
        )}
      </Link>
    </SidebarHeader>
  );
}
