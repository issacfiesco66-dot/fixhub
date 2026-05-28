import { requireAdminOrRedirect } from "../_lib/auth-guard";
import { ScraperClient } from "./_components/ScraperClient";

export const dynamic = "force-dynamic";

export default async function ScraperPage() {
  await requireAdminOrRedirect();
  const configured = !!(process.env.SCRAPER_SERVICE_URL && process.env.SCRAPER_SERVICE_TOKEN);
  return <ScraperClient configured={configured} />;
}
