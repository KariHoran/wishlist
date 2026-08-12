import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Wishlist <no-reply@wishlist.app>";
const APP_URL = process.env.NEXTAUTH_URL ?? "https://wishlist-ashy-three.vercel.app";

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>✦ Wishlist</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:monospace,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 16px 0;text-align:center;">
              <span style="font-size:22px;font-weight:700;letter-spacing:2px;font-family:monospace;">
                ✦ WISHLIST
              </span>
            </td>
          </tr>
          <!-- Main card -->
          <tr>
            <td style="background:#ffffff;border:2px solid #000000;padding:32px 28px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 0 0 0;text-align:center;">
              <span style="font-size:11px;color:#888;font-family:monospace;">
                Вы получили это письмо, потому что включены email-уведомления.
                <a href="${APP_URL}/account" style="color:#888;">Отключить</a>
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function btn(label: string, href: string): string {
  return `<a href="${href}"
    style="display:inline-block;margin-top:20px;padding:10px 22px;background:#000;color:#fff;
           text-decoration:none;font-family:monospace;font-size:13px;border:2px solid #000;
           letter-spacing:0.5px;">${label}</a>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#222;font-family:monospace;">${text}</p>`;
}

function h(text: string): string {
  return `<h1 style="margin:0 0 20px 0;font-size:18px;font-weight:700;font-family:monospace;color:#000;">${text}</h1>`;
}

// ---------- Email payload builders ----------

export type SendEmailOpts = {
  to: string;
  subject: string;
  html: string;
};

async function sendEmail(opts: SendEmailOpts): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email");
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.error("[email] Resend error:", error);
    }
  } catch (err) {
    console.error("[email] unexpected error:", err);
  }
}

/** Fire-and-forget — never awaited by callers */
export function sendEmailFireAndForget(opts: SendEmailOpts): void {
  void sendEmail(opts);
}

// ---------- User email lookup ----------

/**
 * Returns the user's email if they have email notifications enabled,
 * otherwise null. Never throws.
 */
export async function getUserEmailIfEnabled(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailNotificationsEnabled: true },
    });
    if (!user?.emailNotificationsEnabled) return null;
    return user.email;
  } catch {
    return null;
  }
}

// ---------- Typed senders ----------

export function emailItemReserved(opts: {
  to: string;
  itemName: string;
  wishlistTitle: string;
  wishlistId: string;
}) {
  sendEmailFireAndForget({
    to: opts.to,
    subject: `Подарок «${opts.itemName}» забронирован`,
    html: baseTemplate(
      h("Ваш подарок забронирован 🎁") +
      p(`Кто-то зарезервировал <strong>«${opts.itemName}»</strong> из списка «${opts.wishlistTitle}».`) +
      p("Имя не показывается — сюрприз!") +
      btn("Открыть список", `${APP_URL}/wishlist/${opts.wishlistId}`),
    ),
  });
}

export function emailItemContributed(opts: {
  to: string;
  itemName: string;
  wishlistTitle: string;
  wishlistId: string;
  amount: number;
}) {
  const amt = opts.amount.toLocaleString("ru-RU") + " ₽";
  sendEmailFireAndForget({
    to: opts.to,
    subject: `Новый взнос ${amt} на «${opts.itemName}»`,
    html: baseTemplate(
      h("Новый взнос на сбор 💚") +
      p(`На <strong>«${opts.itemName}»</strong> из «${opts.wishlistTitle}» поступил взнос <strong>${amt}</strong>.`) +
      btn("Открыть список", `${APP_URL}/wishlist/${opts.wishlistId}`),
    ),
  });
}

export function emailGoalReached(opts: {
  to: string;
  itemName: string;
  wishlistTitle: string;
  wishlistId: string;
}) {
  sendEmailFireAndForget({
    to: opts.to,
    subject: `Сбор на «${opts.itemName}» завершён!`,
    html: baseTemplate(
      h("Сбор закрыт — 100% собрано! 🎉") +
      p(`Сбор на <strong>«${opts.itemName}»</strong> из «${opts.wishlistTitle}» успешно завершён.`) +
      btn("Открыть список", `${APP_URL}/wishlist/${opts.wishlistId}`),
    ),
  });
}

export function emailCancelledRefundDue(opts: {
  to: string;
  itemName: string;
  wishlistTitle: string;
  amount: number;
}) {
  const amt = opts.amount.toLocaleString("ru-RU") + " ₽";
  sendEmailFireAndForget({
    to: opts.to,
    subject: `Возврат ${amt} — сбор на «${opts.itemName}» отменён`,
    html: baseTemplate(
      h("Вам нужно вернуть деньги ⚠️") +
      p(`Автор отменил сбор на <strong>«${opts.itemName}»</strong> из «${opts.wishlistTitle}».`) +
      p(`Ваш взнос составил <strong>${amt}</strong>. Владелец должен вернуть вам эти деньги вручную.`) +
      btn("Открыть историю возвратов", `${APP_URL}/account/refunds`),
    ),
  });
}

export function emailFriendRequestAccepted(opts: {
  to: string;
  acceptorName: string;
  acceptorHandle: string;
}) {
  sendEmailFireAndForget({
    to: opts.to,
    subject: `${opts.acceptorName} принял(а) вашу заявку`,
    html: baseTemplate(
      h("Новый друг! 🤝") +
      p(`<strong>${opts.acceptorName}</strong> (@${opts.acceptorHandle}) принял(а) вашу заявку в друзья.`) +
      btn("Открыть список друзей", `${APP_URL}/friends`),
    ),
  });
}

export function emailDeadlineReminder(opts: {
  to: string;
  wishlistTitle: string;
  wishlistId: string;
  deadlineDate: string;
}) {
  sendEmailFireAndForget({
    to: opts.to,
    subject: `Напоминание: до дедлайна «${opts.wishlistTitle}» 3 дня`,
    html: baseTemplate(
      h("Скоро дедлайн! ⏳") +
      p(`До дедлайна вашего списка <strong>«${opts.wishlistTitle}»</strong> осталось 3 дня (${opts.deadlineDate}).`) +
      p("Убедитесь, что всё идёт по плану.") +
      btn("Открыть список", `${APP_URL}/wishlist/${opts.wishlistId}`),
    ),
  });
}
