import type { Metadata } from "next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Familienbaum – Historische Dokumente transkribieren",
  description:
    "Alte Familiendokumente in Kurrent & Sütterlin transkribieren, Personen erfassen und den Stammbaum aufbauen",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${playfair.variable} ${sourceSans.variable}`}>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased font-body flex flex-col">
        <header className="border-b border-amber-900/10 bg-gradient-to-b from-[#fdfaf3] to-[#f8f3e8] px-6 py-5">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <span className="text-3xl drop-shadow-sm">🌳</span>
            <div>
              <h1 className="font-display text-2xl font-bold text-stone-800 tracking-tight">
                Familienbaum
              </h1>
              <p className="text-xs text-stone-500 tracking-wide">
                Historische Dokumente transkribieren&ensp;·&ensp;Kurrent &amp; Sütterlin&ensp;·&ensp;Stammbaum
              </p>
            </div>
          </div>
          <div className="max-w-5xl mx-auto mt-4 -mb-5 border-b-2 border-amber-600/60 w-24" />
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8 w-full flex-1">{children}</main>
        <footer className="border-t border-stone-200 mt-12 px-6 py-5 text-center text-xs text-stone-400">
          <span className="font-display italic">Familienbaum</span> · transkribiert mit Claude ·
          alle Daten bleiben lokal in Ihrem Browser
        </footer>
      </body>
    </html>
  );
}
