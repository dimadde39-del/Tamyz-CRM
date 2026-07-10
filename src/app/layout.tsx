import type { Metadata } from "next";
import "@fontsource-variable/ibm-plex-sans";
import "./globals.css";

import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: {
    default: "TAMYZ Ops",
    template: "%s — TAMYZ Ops",
  },
  description: "Операционная CRM агентского теста профессиональной химии в Шымкенте",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
