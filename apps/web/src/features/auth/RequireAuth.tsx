import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '~/components/ui/Spinner';
import { useAuth } from './auth-context';

/**
 * The gate of the protected parts of the application.
 *
 * We keep the target address in the navigation state, so after signing in the
 * user ends up where they were originally headed rather than always on the home
 * page.
 */
export function RequireAuth() {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <PageLoader label="Checking your sign-in…" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** The opposite - it keeps a signed-in user off the sign-in page. */
export function RedirectIfAuthenticated() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) return <PageLoader label="Checking your sign-in…" />;
  if (user) return <Navigate to="/" replace />;

  return <Outlet />;
}
