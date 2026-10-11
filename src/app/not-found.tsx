import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="mt-1 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you were looking for doesn&apos;t exist.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Go to overview
        </Link>
      </div>
    </main>
  );
}
