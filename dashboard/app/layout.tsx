import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import esDict from "@/locales/es.json";

const es = esDict as Record<string, string>;

export const metadata: Metadata = {
  title: es["app.docTitle"],
  description: es["app.eyebrow"]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
