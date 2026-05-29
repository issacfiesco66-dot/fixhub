import type { Metadata } from "next";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { getPublicBaseUrl } from "@/lib/url";

const SITE_TITLE = "FixHub — Técnicos verificados a domicilio";
const SITE_DESCRIPTION =
  "Encuentra técnicos verificados para reparación de electrodomésticos, plomería y electricidad en tu ciudad. Servicio el mismo día.";
const OG_IMAGE = {
  url: "/images/hero.png",
  width: 1536,
  height: 1024,
  alt: "FixHub — técnicos verificados a domicilio en México",
};

export const metadata: Metadata = {
  // metadataBase resuelve canonical, og:url y og:image a URLs absolutas.
  metadataBase: new URL(getPublicBaseUrl()),
  title: {
    default: SITE_TITLE,
    template: "%s | FixHub",
  },
  description: SITE_DESCRIPTION,
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
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  verification: {
    google: "S2Bf4K8xefjmyZ4CuLxJilThBoMap0J8F61FPbyYXgo",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
