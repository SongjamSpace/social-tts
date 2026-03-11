import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-zinc-400 text-sm mb-4">The page you’re looking for doesn’t exist.</p>
      <Link
        href="/"
        className="text-red-400 hover:text-red-300 text-sm font-medium"
      >
        Back to Eve
      </Link>
    </div>
  );
}
