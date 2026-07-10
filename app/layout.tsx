import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FTF - Fédération Tunisienne de Football",
  description: "Système de gestion de la Fédération Tunisienne de Football",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem("theme");
                var s = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                var r = t || s || "light";
                document.documentElement.className = r;
                document.documentElement.style.colorScheme = r;
              } catch(e) {}
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
