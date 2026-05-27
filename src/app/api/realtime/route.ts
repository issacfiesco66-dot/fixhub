import { NextRequest } from "next/server";
import { broker, type LeadAlertPayload } from "@/lib/realtime";
import { getCurrentTechnician } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE — el técnico se conecta y recibe alertas filtradas por sus
// ciudades de cobertura × servicios que atiende.
//
// Producción: si esto corre en Vercel/edge con timeout, mueve a Pusher/Ably
// o usa un long-running worker. La API del broker no cambia.
export async function GET(_req: NextRequest) {
  const tech = await getCurrentTechnician();
  if (!tech) return new Response("Unauthorized", { status: 401 });

  // Calcular todos los canales que le interesan a este técnico
  const channels: string[] = [];
  for (const cov of tech.coverages) {
    for (const sv of tech.services) {
      channels.push(broker.channelOf(cov.cityId, sv.serviceId));
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Handshake — confirma canales activos
      send("ready", {
        channels,
        technician: { id: tech.id, name: tech.displayName, balance: tech.balance },
      });

      const onMessage = (msg: LeadAlertPayload) => {
        send("lead", msg);
      };
      const unsubscribe = broker.subscribe(channels, onMessage);

      // Keep-alive — comentarios SSE cada 25s para evitar timeouts de proxy
      const ka = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
        } catch {
          /* closed */
        }
      }, 25_000);

      // Cleanup al cerrar la conexión
      const close = () => {
        clearInterval(ka);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      // @ts-expect-error — Next pasa el signal en el request, no en el controller
      _req.signal?.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx
    },
  });
}
