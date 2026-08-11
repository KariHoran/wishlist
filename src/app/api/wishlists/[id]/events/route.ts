import { subscribeWishlist } from "@/lib/realtime";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const encoder = new TextEncoder();

  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: "connected", wishlistId: id });
      cleanup = subscribeWishlist(id, (payload) => {
        send({ type: "update", ...payload });
      });

      const ping = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        cleanup?.();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
