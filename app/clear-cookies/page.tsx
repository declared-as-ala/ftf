'use client';

import { useEffect } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export default function ClearCookiesPage() {
  const router = useRouter();

  // Page utilitaire de développement uniquement
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  useEffect(() => {
    // Nettoyer tous les cookies
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-center">
            Cookies Nettoyés
          </CardTitle>
          <CardDescription className="text-center">
            Tous les cookies de session ont été supprimés avec succès
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Vous pouvez maintenant vous connecter sans erreurs JWT
          </p>

          <Button 
            className="w-full" 
            onClick={() => router.push('/login')}
          >
            Aller à la page de connexion
          </Button>

          <div className="pt-4 border-t space-y-2">
            <p className="text-xs text-muted-foreground text-center font-semibold">
              Identifiants de test :
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="text-center">
                <strong>Admin :</strong> admin@ftf.tn / Admin@123
              </p>
              <p className="text-center">
                <strong>Club 1 :</strong> club1@club.tn / Club@123
              </p>
              <p className="text-center">
                <strong>Club 2 :</strong> club2@club.tn / Club@123
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







