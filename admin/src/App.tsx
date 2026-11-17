import AppLayout from "@/components/layout/app-layout";
import ContentEditorPage from "@/pages/main/content/editor-page";
import ContentListPage from "@/pages/main/content/list-page";
import CommentsPage from "@/pages/main/content/comments-page";
import MediaPage from "@/pages/main/content/media-page";
import TermsPage from "@/pages/main/content/terms-page";
import CmsDashboardPage from "@/pages/main/dashboard/cms/page";
import MenusPage from "@/pages/main/site/menus-page";
import RedirectsPage from "@/pages/main/site/redirects-page";
import SeoPage from "@/pages/main/site/seo-page";
import SettingsPage from "@/pages/main/site/settings-page";
import ReadingSettingsPage from "@/pages/main/site/reading-settings-page";
import ThemesPage from "@/pages/main/site/themes-page";
import PluginsPage from "@/pages/main/site/plugins-page";
import UsersPage from "@/pages/main/site/users-page";
import UserCreatePage from "@/pages/main/site/user-create-page";
import UserEditPage from "@/pages/main/site/user-edit-page";
import { Error404Page } from "@/pages/main/pages";
import ProfilePage from "@/pages/main/profile";
import { GuestRoute, ProtectedRoute } from "@/components/shared/protected-route";
import { AuthLayout, SignInPage, SignUpPage } from "@/pages/others/auth";
import LogoutPage from "@/pages/others/logout-page";
import { Route, Routes } from "react-router";

export default function App() {
  return (
    <Routes>
      {/* Dashboard Layout (auth required) */}
      <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<CmsDashboardPage />} />

        {/* Content — generic for any post type (post, page, or custom) */}
        <Route path="/content/:type" element={<ContentListPage />} />
        <Route path="/content/:type/new" element={<ContentEditorPage />} />
        <Route path="/content/:type/:id/edit" element={<ContentEditorPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/comments" element={<CommentsPage />} />
        <Route path="/taxonomy/:tax" element={<TermsPage />} />

        {/* Appearance & settings */}
        <Route path="/menus" element={<MenusPage />} />
        <Route path="/themes" element={<ThemesPage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/new" element={<UserCreatePage />} />
        <Route path="/users/:id/edit" element={<UserEditPage />} />
        <Route path="/seo" element={<SeoPage />} />
        <Route path="/redirects" element={<RedirectsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/reading" element={<ReadingSettingsPage />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<ProfilePage />} />
      </Route>
      </Route>

      {/* Auth Layout (redirect away if already signed in) */}
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Route>
      </Route>

      {/* Logout (always accessible) */}
      <Route path="/logout" element={<LogoutPage />} />

      {/* Full-width / Error / Status Pages */}
      <Route path="/error-404" element={<Error404Page />} />

      {/* Fallback Route */}
      <Route path="*" element={<Error404Page />} />
    </Routes>
  );
}
