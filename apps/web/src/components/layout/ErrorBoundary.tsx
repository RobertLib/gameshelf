import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, ButtonLink, buttonClasses } from '~/components/ui/Button';

/**
 * A rescue screen for errors the data layer does not catch - typically an
 * exception while rendering a component.
 *
 * It has to be a class component: `componentDidCatch` has no hook equivalent.
 * This same spot used to hold a `RouteErrorBoundary` built on `useRouteError`,
 * but that only works with the data router (`createBrowserRouter`). The
 * application uses classic `<Routes>`, so it never engaged and an exception
 * ended in a blank page.
 *
 * The fallback below therefore must not touch react-router. It is mounted
 * *above* `<BrowserRouter>` (see `main.tsx`, deliberately, so that it also
 * catches errors from the providers), and catching an error unmounts the router
 * along with everything else. A `<Link>` in the fallback would then throw
 * "useHref() may be used only in the context of a <Router> component" - the
 * rescue screen would crash on the way in and leave exactly the blank page it
 * exists to prevent. A plain `<a>` loses nothing here: recovering from a broken
 * render wants a full page load anyway.
 */
interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Without writing to the console, not even a developer would learn about it.
    console.error('Uncaught error while rendering:', error, info);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <span className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-950 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {/* The raw message is for whoever can act on it. In production it
                would only leak internals to somebody who cannot. */}
            {import.meta.env.DEV && error.message
              ? error.message
              : 'Try reloading the page.'}
          </p>
          <div className="flex gap-2">
            {/* Re-rendering is worth a try for an error from a single screen. */}
            <Button variant="outline" onClick={this.reset}>
              Try again
            </Button>
            <a href="/" className={buttonClasses()}>
              Back to the collection
            </a>
          </div>
        </div>
      </div>
    );
  }
}

/** The landing page for unknown addresses. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-5xl font-bold text-slate-200 dark:text-slate-800">
          404
        </p>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          There is no such page here
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The link is probably outdated or contains a typo.
        </p>
        <ButtonLink to="/">Back to the collection</ButtonLink>
      </div>
    </div>
  );
}
