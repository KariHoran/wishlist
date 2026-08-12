"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, Suspense, useState } from "react";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { WinSetup, WinWelcome } from "@/components/WinDecor";
import { useNetwork } from "@/components/NetworkProvider";

const LOGIN_TIMEOUT_MS = 10_000;

function LoginForm() {
  const search = useSearchParams();
  const { online, requireOnline } = useNetwork();
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

      // Auth.js may return { error, ok, url } or (in some betas) a URL string
      if (typeof signInResult === "string") {
        if (signInResult.includes("error=")) {
          setError("Неверный email или пароль");
          return;
        }
        window.location.assign(signInResult || "/dashboard");
        return;
      }

      if (!signInResult) {
        setError("Не удалось войти, попробуйте снова");
        return;
      }

      if (signInResult.error || signInResult.ok === false) {
        setError("Неверный email или пароль");
        return;
      }

      if (signInResult.url && signInResult.url.includes("error=")) {
        setError("Неверный email или пароль");
        return;
      }

      // remember me: session strategy is JWT; cookie maxAge handled by auth defaults
      void remember;
      const callback = search.get("callbackUrl") || "/dashboard";
      // Full navigation so middleware sees the new session cookie
      window.location.assign(callback);
    } catch (err) {
      if (err instanceof Error && err.message === "timeout") {
        setError("Не удалось войти, попробуйте снова");
      } else {
        setError("Ошибка сети — попробуйте ещё раз");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="hard-border w-full space-y-5 bg-white/90 p-5 md:p-6">
      <div>
        <label htmlFor="email" className="pixel-font mb-2 block text-sm">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="Ваша почта"
          className="input-field"
          autoComplete="email"
        />
      </div>
      <div>
        <label htmlFor="password" className="pixel-font mb-2 block text-sm">
          Пароль
        </label>
        <PasswordInput
          id="password"
          name="password"
          placeholder="Ваш пароль"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="mono-font flex items-center gap-2 text-lg">
          <input type="checkbox" name="remember" className="h-4 w-4 accent-black" />
          Запомнить меня
        </label>
        <span className="pixel-font text-[10px] text-[#aaa]">Забыли пароль?</span>
      </div>

      {error && <p className="mono-font text-base text-red-600">{error}</p>}

      <button type="submit" disabled={loading || !online} className="btn-primary w-full py-3 text-base" title={!online ? "Нет соединения" : undefined}>
        {loading ? "..." : "Войти"}
      </button>

      <p className="mono-font text-center text-lg text-[#777]">
        Еще нет аккаунта?{" "}
        <Link href="/register" className="underline underline-offset-4 leading-normal">
          Регистрация
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="page-frame grid-bg relative isolate overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/halftone-cat.svg"
        alt=""
        loading="lazy"
        decoding="async"
        className="page-decor top-10 left-4 hidden w-24 opacity-80 lg:block"
      />
      <div
        aria-hidden
        className="page-decor top-1/2 left-6 hidden h-14 w-14 -translate-y-1/2 bg-[url('/decor/pixel-bunny.svg')] bg-contain bg-center bg-no-repeat opacity-80 lg:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/disk.svg"
        alt=""
        loading="lazy"
        decoding="async"
        className="page-decor bottom-10 left-8 hidden w-16 opacity-80 lg:block"
      />
      <div className="page-decor top-8 right-4 z-0 hidden opacity-90 lg:block">
        <WinWelcome />
        <WinSetup className="mt-[-12px] ml-8 rotate-2" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/orbit-star.svg"
        alt=""
        loading="lazy"
        decoding="async"
        className="page-decor right-6 bottom-10 hidden w-20 opacity-80 lg:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/pixel-star.svg"
        alt=""
        loading="lazy"
        decoding="async"
        className="page-decor top-8 left-[8%] hidden w-9 opacity-70 xl:block"
      />

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-10px)] w-full max-w-md flex-col items-center justify-center px-4 py-10">
        <Logo size="lg" href={null} />
        <p className="pixel-font mt-3 mb-8 text-center text-xs md:text-sm">
          Welcome back! Let&apos;s check your wishes
        </p>
        <Suspense fallback={<div className="hard-border w-full p-6">...</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
