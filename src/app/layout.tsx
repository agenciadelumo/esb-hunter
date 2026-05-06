import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ESB-HUNTER",
  description: "Agente comercial para prospecção industrial e iluminação LED ESBLight.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
