import { auth } from "@/lib/auth";
import { subscribeUserNotifications } from "@/lib/realtime";
import { tError } from "@/lib/i18n-server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(await tError("unauthorized"), { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeSend = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
          if (ping) clearInterval(ping);
          cleanup?.();
        }
      };

      safeSend({ type: "connected", userId });
      cleanup = subscribeUserNotifications(userId, () => {
        safeSend({ type: "notification", userId, at: Date.now() });
      });

      ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
          clearInterval(ping);
          cleanup?.();
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (ping) clearInterval(ping);
        cleanup?.();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      closed = true;
      if (ping) clearInterval(ping);
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
