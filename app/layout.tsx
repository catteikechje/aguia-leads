import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Águia Leads",
  description: "Encontre empresas reais sem site e chame no WhatsApp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
