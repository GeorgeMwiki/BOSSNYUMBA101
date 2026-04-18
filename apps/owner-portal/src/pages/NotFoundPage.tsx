import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div
      role="main"
      className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8"
    >
      <div className="mx-auto max-w-md text-center">
        <p className="mb-2 text-6xl font-bold text-blue-600">404</p>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Page Not Found</h1>
        <p className="mb-8 text-sm text-gray-600">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          to="/dashboard"
          className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
