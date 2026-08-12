import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailDeadlineReminder, getUserEmailIfEnabled } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  // Find wishlists with deadline in [now+2d23h, now+3d1h] window
  const windowStart = new Date(in3days.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(in3days.getTime() + 60 * 60 * 1000);

  const wishlists = await prisma.wishlist.findMany({
    where: {
      deadline: { gte: windowStart, lte: windowEnd },
    },
    include: {
      owner: { select: { id: true, email: true, emailNotificationsEnabled: true } },
    },
  });

  let sent = 0;
  for (const w of wishlists) {
    if (!w.owner.emailNotificationsEnabled) continue;
    const email = await getUserEmailIfEnabled(w.owner.id);
    if (!email) continue;
    const deadlineDate = w.deadline!.toLocaleDateString("ru-RU");
    emailDeadlineReminder({
      to: email,
      wishlistTitle: w.title,
      wishlistId: w.id,
      deadlineDate,
    });
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
