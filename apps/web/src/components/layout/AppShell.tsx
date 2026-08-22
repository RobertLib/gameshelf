import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  Gamepad2,
  LogOut,
  Menu,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { Button, ButtonLink } from '~/components/ui/Button';
import { cn } from '~/lib/cn';
import { useAuth } from '~/features/auth/auth-context';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { to: '/', label: 'Collection', icon: Gamepad2, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
] as const;

/** The frame of the signed-in part of the application: top bar, navigation and page content. */
export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      {/* A keyboard link - the first tab on the page skips the navigation. */}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-50"
          >
            <span className="rounded-lg bg-brand-600 p-1.5 text-white">
              <Gamepad2 className="h-4 w-4" aria-hidden />
            </span>
            GameShelf
          </Link>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* The wrapper handles visibility - if `hidden` sat on the button
                itself, `inline-flex` from its own classes would override it. */}
            <span className="hidden sm:block">
              <ButtonLink to="/game/new" size="sm">
                <Plus className="h-4 w-4" aria-hidden />
                Add a game
              </ButtonLink>
            </span>

            <ThemeToggle />

            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-32 truncate text-sm text-slate-500 dark:text-slate-400">
                {user?.displayName}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void logout()}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Menu"
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav
            className="border-t border-slate-200 px-4 py-2 sm:hidden dark:border-slate-800"
            aria-label="Main (mobile)"
          >
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavItem {...item} onClick={() => setMenuOpen(false)} block />
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out ({user?.displayName})
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main id="content">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onClick,
  block,
}: {
  to: string;
  label: string;
  icon: typeof Gamepad2;
  end: boolean;
  onClick?: () => void;
  block?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          block && 'w-full',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
        )
      }
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </NavLink>
  );
}
