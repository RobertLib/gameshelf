import { Route, Routes } from 'react-router-dom';
import { AppShell } from '~/components/layout/AppShell';
import { NotFoundPage } from '~/components/layout/ErrorBoundary';
import {
  RedirectIfAuthenticated,
  RequireAuth,
} from '~/features/auth/RequireAuth';
import { LoginPage } from '~/features/auth/LoginPage';
import { RegisterPage } from '~/features/auth/RegisterPage';
import { GamesPage } from '~/features/games/GamesPage';
import { GameDetailPage } from '~/features/games/GameDetailPage';
import { EditGamePage, NewGamePage } from '~/features/games/GameFormPage';
import { DashboardPage } from '~/features/dashboard/DashboardPage';
import { SettingsPage } from '~/features/settings/SettingsPage';

/**
 * The map of screens.
 *
 * The list filters live in the query string (see `useGameFilters`), so a link to
 * "unfinished PS2 games" is an ordinary URL that can be bookmarked.
 */
export function App() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<GamesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/game/new" element={<NewGamePage />} />
          <Route path="/game/:id" element={<GameDetailPage />} />
          <Route path="/game/:id/edit" element={<EditGamePage />} />
          {/*
            The only catch-all in the tree. A second one at the top level was
            unreachable: React Router scores both `*` patterns the same and
            breaks the tie by declaration order, so this branch always won -
            and an unauthenticated visitor is sent to the sign-in page by
            `RequireAuth` above, then brought back here.
          */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
