import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FixHub — Técnicos verificados a domicilio",
    template: "%s | FixHub",
  },
  description:
    "Encuentra técnicos verificados para reparación de electrodomésticos, plomería y electricidad en tu ciudad. Servicio el mismo día.",
  keywords: [
    "reparación electrodomésticos",
    "técnico a domicilio",
    "plomería",
    "electricidad",
    "servicios locales",
  ],
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "FixHub",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
