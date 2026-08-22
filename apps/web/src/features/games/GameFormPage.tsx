import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { CreateGameInput } from '@gameshelf/contracts';
import { Alert } from '~/components/ui/Alert';
import { ButtonLink } from '~/components/ui/Button';
import { PageLoader } from '~/components/ui/Spinner';
import { errorMessage } from '~/lib/api-error';
import { useCatalog, useCreateGame, useGameQuery, useUpdateGame } from './api';
import { GameForm } from './components/GameForm';

/** Adding a new game to the collection. */
export function NewGamePage() {
  const navigate = useNavigate();
  const catalog = useCatalog();
  const createGame = useCreateGame();

  const handleSubmit = async (values: CreateGameInput) => {
    const game = await createGame.mutateAsync(values);
    await navigate(`/game/${game.id}`, { replace: true });
  };

  if (catalog.isPending)
    return <PageLoader label="Loading the lookup tables…" />;
  if (catalog.isError) {
    return (
      <div className="page-shell">
        <Alert tone="error" title="Platforms and genres could not be loaded">
          {errorMessage(catalog.error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-4xl">
      <PageHeader
        backTo="/"
        backLabel="Back to the collection"
        title="New game"
      />
      <GameForm
        catalog={catalog.data}
        submitLabel="Add to the collection"
        onSubmit={handleSubmit}
      />
    </div>
  );
}

/** Editing an existing game. */
export function EditGamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const game = useGameQuery(id);
  const updateGame = useUpdateGame(id ?? '');

  const handleSubmit = async (values: CreateGameInput) => {
    const updated = await updateGame.mutateAsync(values);
    await navigate(`/game/${updated.id}`, { replace: true });
  };

  if (catalog.isPending || game.isPending) {
    return <PageLoader label="Loading the game…" />;
  }

  if (game.isError || catalog.isError) {
    return (
      <div className="page-shell">
        <Alert tone="error" title="The game could not be loaded">
          {errorMessage(game.error ?? catalog.error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-4xl">
      <PageHeader
        backTo={`/game/${game.data.id}`}
        backLabel="Back to the detail"
        title={`Edit "${game.data.title}"`}
      />
      <GameForm
        catalog={catalog.data}
        game={game.data}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function PageHeader({
  backTo,
  backLabel,
  title,
}: {
  backTo: string;
  backLabel: string;
  title: string;
}) {
  return (
    <header className="mb-6">
      <ButtonLink to={backTo} variant="ghost" size="sm" className="-ml-2 mb-2">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {backLabel}
      </ButtonLink>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        {title}
      </h1>
    </header>
  );
}
