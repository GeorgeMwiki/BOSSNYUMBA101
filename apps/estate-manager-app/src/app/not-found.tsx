import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8">
      <div className="mx-auto max-w-md text-center">
        <p className="mb-2 text-6xl font-bold text-sky-500">404</p>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Page Not Found</h2>
        <p className="mb-8 text-sm text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
