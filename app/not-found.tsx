import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-6">Page introuvable</p>
      <Link href="/" className="text-primary hover:underline">
        Retour à l'accueil
      </Link>
    </div>
  );
}
