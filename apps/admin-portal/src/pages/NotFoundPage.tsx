import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div
      role="main"
      className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-white"
    >
      <div className="mx-auto max-w-md text-center">
        <p className="mb-2 text-6xl font-bold text-violet-400">404</p>
        <h1 className="mb-2 text-xl font-semibold">Page Not Found</h1>
        <p className="mb-8 text-sm text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have
          access to it.
        </p>
        <Link
          to="/"
          className="inline-block rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
