import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getUserLocale } from "@/lib/notifications";
import { loadMessagesSync } from "@/i18n/load-messages";
import { formatCurrency } from "@/lib/money";
import {
  defaultLocale,
  parseLocale,
  type AppLocale,
  type WishlistCurrency,
} from "@/i18n/config";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Wishlist <no-reply@wishlist.app>";
const APP_URL = process.env.NEXTAUTH_URL ?? "https://wishlist-ashy-three.vercel.app";

type EmailMessages = Record<string, string>;

function emailMsg(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const messages = loadMessagesSync(locale) as { email?: EmailMessages };
  let text = messages.email?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}

async function resolveSenderLocale(opts: {
  locale?: AppLocale;
  userId?: string;
}): Promise<AppLocale> {
  if (opts.locale) return opts.locale;
  if (opts.userId) return getUserLocale(opts.userId);
  return defaultLocale;
}

function baseTemplate(content: string, locale: AppLocale): string {
  const messages = loadMessagesSync(locale) as { email?: EmailMessages };
  const htmlLang = messages.email?.htmlLang ?? locale;
  const footer = messages.email?.footer ?? "";
  const disable = messages.email?.disable ?? "";

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
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
                ${footer}
                <a href="${APP_URL}/account" style="color:#888;">${disable}</a>
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

export type EmailRecipient = {
  email: string;
  locale: AppLocale;
};

/**
 * Returns the user's email and locale if they have email notifications enabled,
 * otherwise null. Never throws.
 */
export async function getUserEmailAndLocale(
  userId: string,
): Promise<EmailRecipient | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailNotificationsEnabled: true, locale: true },
    });
    if (!user?.emailNotificationsEnabled || !user.email) return null;
    return { email: user.email, locale: parseLocale(user.locale) };
  } catch {
    return null;
  }
}

/**
 * Returns the user's email if they have email notifications enabled,
 * otherwise null. Never throws.
 */
export async function getUserEmailIfEnabled(userId: string): Promise<string | null> {
  const recipient = await getUserEmailAndLocale(userId);
  return recipient?.email ?? null;
}

// ---------- Typed senders ----------

export function emailItemReserved(opts: {
  userId?: string;
  locale?: AppLocale;
  to: string;
  itemName: string;
  wishlistTitle: string;
  wishlistId: string;
}) {
  void (async () => {
    const locale = await resolveSenderLocale(opts);
    sendEmailFireAndForget({
      to: opts.to,
      subject: emailMsg(locale, "reservedSubject", { itemName: opts.itemName }),
      html: baseTemplate(
        h(emailMsg(locale, "reservedHeading")) +
          p(
            emailMsg(locale, "reservedBody", {
              itemName: opts.itemName,
              wishlistTitle: opts.wishlistTitle,
            }),
          ) +
          p(emailMsg(locale, "reservedSurprise")) +
          btn(emailMsg(locale, "openList"), `${APP_URL}/wishlist/${opts.wishlistId}`),
        locale,
      ),
    });
  })();
}

export function emailItemContributed(opts: {
  userId?: string;
  locale?: AppLocale;
  to: string;
  itemName: string;
  wishlistTitle: string;
  wishlistId: string;
  amount: number;
  currency?: WishlistCurrency;
}) {
  void (async () => {
    const locale = await resolveSenderLocale(opts);
    const amt = formatCurrency(opts.amount, opts.currency, locale);
    sendEmailFireAndForget({
      to: opts.to,
      subject: emailMsg(locale, "contributedSubject", {
        amount: amt,
        itemName: opts.itemName,
      }),
      html: baseTemplate(
        h(emailMsg(locale, "contributedHeading")) +
          p(
            emailMsg(locale, "contributedBody", {
              itemName: opts.itemName,
              wishlistTitle: opts.wishlistTitle,
              amount: amt,
            }),
          ) +
          btn(emailMsg(locale, "openList"), `${APP_URL}/wishlist/${opts.wishlistId}`),
        locale,
      ),
    });
  })();
}

export function emailGoalReached(opts: {
  userId?: string;
  locale?: AppLocale;
  to: string;
  itemName: string;
  wishlistTitle: string;
  wishlistId: string;
}) {
  void (async () => {
    const locale = await resolveSenderLocale(opts);
    sendEmailFireAndForget({
      to: opts.to,
      subject: emailMsg(locale, "goalSubject", { itemName: opts.itemName }),
      html: baseTemplate(
        h(emailMsg(locale, "goalHeading")) +
          p(
            emailMsg(locale, "goalBody", {
              itemName: opts.itemName,
              wishlistTitle: opts.wishlistTitle,
            }),
          ) +
          btn(emailMsg(locale, "openList"), `${APP_URL}/wishlist/${opts.wishlistId}`),
        locale,
      ),
    });
  })();
}

export function emailCancelledRefundDue(opts: {
  userId?: string;
  locale?: AppLocale;
  to: string;
  itemName: string;
  wishlistTitle: string;
  amount: number;
  currency?: WishlistCurrency;
}) {
  void (async () => {
    const locale = await resolveSenderLocale(opts);
    const amt = formatCurrency(opts.amount, opts.currency, locale);
    sendEmailFireAndForget({
      to: opts.to,
      subject: emailMsg(locale, "refundSubject", {
        amount: amt,
        itemName: opts.itemName,
      }),
      html: baseTemplate(
        h(emailMsg(locale, "refundHeading")) +
          p(
            emailMsg(locale, "refundBody", {
              itemName: opts.itemName,
              wishlistTitle: opts.wishlistTitle,
            }),
          ) +
          p(emailMsg(locale, "refundAmount", { amount: amt })) +
          btn(emailMsg(locale, "openRefunds"), `${APP_URL}/account/refunds`),
        locale,
      ),
    });
  })();
}

export function emailFriendRequestAccepted(opts: {
  userId?: string;
  locale?: AppLocale;
  to: string;
  acceptorName: string;
  acceptorHandle: string;
}) {
  void (async () => {
    const locale = await resolveSenderLocale(opts);
    sendEmailFireAndForget({
      to: opts.to,
      subject: emailMsg(locale, "friendSubject", { name: opts.acceptorName }),
      html: baseTemplate(
        h(emailMsg(locale, "friendHeading")) +
          p(
            emailMsg(locale, "friendBody", {
              name: opts.acceptorName,
              handle: opts.acceptorHandle,
            }),
          ) +
          btn(emailMsg(locale, "openFriends"), `${APP_URL}/friends`),
        locale,
      ),
    });
  })();
}

export function emailDeadlineReminder(opts: {
  userId?: string;
  locale?: AppLocale;
  to: string;
  wishlistTitle: string;
  wishlistId: string;
  deadlineDate: string;
}) {
  void (async () => {
    const locale = await resolveSenderLocale(opts);
    sendEmailFireAndForget({
      to: opts.to,
      subject: emailMsg(locale, "deadlineSubject", {
        wishlistTitle: opts.wishlistTitle,
      }),
      html: baseTemplate(
        h(emailMsg(locale, "deadlineHeading")) +
          p(
            emailMsg(locale, "deadlineBody", {
              wishlistTitle: opts.wishlistTitle,
              deadlineDate: opts.deadlineDate,
            }),
          ) +
          p(emailMsg(locale, "deadlineHint")) +
          btn(emailMsg(locale, "openList"), `${APP_URL}/wishlist/${opts.wishlistId}`),
        locale,
      ),
    });
  })();
}
