import { SidebarHeader } from "@/components/ui/sidebar";
import { asset } from "@/utils/asset";
import { Link } from "react-router";

interface AppSidebarHeaderProps {
  showContent: boolean;
}

export default function AppSidebarHeader({
  showContent,
}: AppSidebarHeaderProps) {
  return (
    <SidebarHeader className="px-5 py-8">
      <Link to="/">
        {showContent ? (
          <>
            <img
              className="h-10 w-37.5 dark:hidden"
              src={asset("/images/logo/logo.svg")}
              alt="Logo"
            />
            <img
              className="hidden h-10 w-37.5 dark:block"
              src={asset("/images/logo/logo-dark.svg")}
              alt="Logo"
            />
          </>
        ) : (
          <img src={asset("/images/logo/logo-icon.svg")} alt="Logo" className="size-8" />
        )}
      </Link>
    </SidebarHeader>
  );
}
