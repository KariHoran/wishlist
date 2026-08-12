"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, Suspense, useState } from "react";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { DecorImage } from "@/components/DecorImage";
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
      <DecorImage
        src="/decor/cat-halftone-face.png"
        width={200}
        height={220}
        className="top-16 left-2 hidden w-36 opacity-90 lg:block xl:w-48"
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
        className="top-40 right-10 hidden w-48 rotate-2 opacity-95 lg:block"
      />
      <DecorImage
        src="/decor/disk-cd.png"
        width={96}
        height={125}
        className="right-8 bottom-20 hidden w-20 opacity-90 lg:block"
      />
      <DecorImage
        src="/decor/bunny-pixel.png"
        width={72}
        height={78}
        className="right-6 bottom-6 hidden w-14 opacity-90 lg:block"
      />
      <DecorImage
        src="/decor/star-pixel-pastel.png"
        width={48}
        height={48}
        className="top-10 left-[12%] hidden w-10 opacity-80 xl:block"
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
