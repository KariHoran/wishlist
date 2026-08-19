import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailDeadlineReminder, getUserEmailAndLocale } from "@/lib/email";
import { jsonError } from "@/lib/api-response";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return jsonError("unauthorized", 401);
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
  const skipped: string[] = [];
  for (const w of wishlists) {
    if (!w.owner.emailNotificationsEnabled) {
      skipped.push(`${w.id}:notifications-disabled`);
      continue;
    }
    const recipient = await getUserEmailAndLocale(w.owner.id);
    if (!recipient) {
      skipped.push(`${w.id}:no-email`);
      continue;
    }
    const deadlineDate = formatDate(w.deadline!, recipient.locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    emailDeadlineReminder({
      userId: w.owner.id,
      locale: recipient.locale,
      to: recipient.email,
      wishlistTitle: w.title,
      wishlistId: w.id,
      deadlineDate,
    });
    sent++;
  }

  return NextResponse.json({
    ok: true,
    sent,
    matched: wishlists.length,
    skipped,
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
  });
}
