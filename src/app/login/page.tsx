"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { DecorImage } from "@/components/DecorImage";
import { useNetwork } from "@/components/NetworkProvider";

const LOGIN_TIMEOUT_MS = 10_000;

function LoginForm() {
  const search = useSearchParams();
  const { online, requireOnline } = useNetwork();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const remember = fd.get("remember") === "on";

    try {
      const result = await Promise.race([
        signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl: search.get("callbackUrl") || "/dashboard",
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), LOGIN_TIMEOUT_MS);
        }),
      ]);

      const signInResult = result as
        | { error?: string | null; ok?: boolean; url?: string | null }
        | string
        | undefined;

      if (typeof signInResult === "string") {
        if (signInResult.includes("error=")) {
          setError(t("invalidCredentials"));
          return;
        }
        window.location.assign(signInResult || "/dashboard");
        return;
      }

      if (!signInResult) {
        setError(t("loginFailed"));
        return;
      }

      if ((signInResult as { status?: number }).status === 429) {
        setError(t("tooManyAttempts"));
        return;
      }

      if (signInResult.error || signInResult.ok === false) {
        setError(t("invalidCredentials"));
        return;
      }

      if (signInResult.url && signInResult.url.includes("error=")) {
        setError(t("invalidCredentials"));
        return;
      }

      void remember;
      const callback = search.get("callbackUrl") || "/dashboard";
      window.location.assign(callback);
    } catch (err) {
      if (err instanceof Error && err.message === "timeout") {
        setError(t("loginFailed"));
      } else if (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        Number((err as { status: unknown }).status) === 429
      ) {
        setError(t("tooManyAttempts"));
      } else {
        setError(t("networkError"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="hard-border shadow-offset w-full space-y-5 bg-white p-5 md:p-6">
      <div>
        <label htmlFor="email" className="pixel-font mb-2 block text-sm">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder={t("emailPlaceholder")}
          className="input-field"
          autoComplete="email"
        />
      </div>
      <div>
        <label htmlFor="password" className="pixel-font mb-2 block text-sm">
          {t("password")}
        </label>
        <PasswordInput
          id="password"
          name="password"
          placeholder={t("passwordPlaceholder")}
          autoComplete="current-password"
          required
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="mono-font flex items-center gap-2 text-lg">
          <input type="checkbox" name="remember" className="h-4 w-4 accent-black" />
          {t("rememberMe")}
        </label>
        <span className="pixel-font text-[10px] text-[#aaa]">{t("forgotPassword")}</span>
      </div>

      {error && <p className="mono-font text-base text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !online}
        className="btn-primary w-full py-3 text-base"
        title={!online ? tCommon("noConnection") : undefined}
      >
        {loading ? tCommon("loading") : t("submitLogin")}
      </button>

      <p className="mono-font text-center text-lg text-[#777]">
        {t("noAccount")}{" "}
        <Link href="/register" className="underline underline-offset-4 leading-normal">
          {tCommon("signUp")}
        </Link>
      </p>
    </form>
  );
}

function LoginPageContent() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  return (
    <div className="page-frame grid-bg relative isolate overflow-hidden">
      <DecorImage
        src="/decor/cat-halftone-face.png"
        width={220}
        height={240}
        className="top-14 left-3 hidden w-40 opacity-95 lg:block xl:left-6 xl:w-52"
      />
      <DecorImage
        src="/decor/bunny-pixel.png"
        width={72}
        height={78}
        className="top-1/2 left-6 hidden w-14 -translate-y-1/2 opacity-95 lg:block"
      />
      <DecorImage
        src="/decor/disk-cd.png"
        width={96}
        height={125}
        className="bottom-10 left-6 hidden w-16 opacity-95 lg:block"
      />
      <DecorImage
        src="/decor/windows-welcome-dialog.png"
        width={210}
        height={246}
        className="top-6 right-4 hidden w-44 opacity-95 lg:block"
      />
      <DecorImage
        src="/decor/windows-setup-dialog.png"
        width={220}
        height={120}
        className="top-44 right-10 hidden w-48 rotate-2 opacity-95 lg:block"
      />
      <DecorImage
        src="/decor/orbit-star.svg"
        width={80}
        height={80}
        className="right-8 bottom-10 hidden w-20 opacity-90 lg:block"
      />

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-10px)] w-full max-w-md flex-col items-center justify-center px-4 py-10">
        <Logo size="lg" href={null} priority />
        <p className="pixel-font mt-3 mb-8 text-center text-xs md:text-sm">{t("tagline")}</p>
        <Suspense fallback={<div className="hard-border shadow-offset w-full p-6">{tCommon("loading")}</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
