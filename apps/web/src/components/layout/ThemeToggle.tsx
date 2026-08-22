import { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { useLocalStorage } from '~/lib/use-local-storage';

type Theme = 'light' | 'dark';
const isTheme = (value: string): value is Theme =>
  value === 'light' || value === 'dark';

/**
 * The system preference as the default value. It is a lazy function, not an
 * expression in the argument - that would be evaluated on every render even
 * though `useState` uses it only once.
 */
const systemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/**
 * The light/dark theme switch.
 *
 * It takes its default value from the system setting; the script in `index.html`
 * applies it before the first paint, so the page does not flash. All that is
 * handled here is the manual switch and remembering it.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage<Theme>(
    'gameshelf:theme',
    systemTheme,
    isTheme,
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={
        theme === 'dark'
          ? 'Switch to the light theme'
          : 'Switch to the dark theme'
      }
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
}
