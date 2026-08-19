"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useNetwork } from "@/components/NetworkProvider";
import { ModalDialog } from "@/components/ModalDialog";
import { currencies, defaultCurrency } from "@/i18n/config";

export function CreateWishlistButton() {
  const router = useRouter();
  const { online, requireOnline } = useNetwork();
  const t = useTranslations("wishlistForm");
  const tCurrency = useTranslations("currency");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/wishlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        deadline: fd.get("deadline") || null,
        isPublic: fd.get("isPublic") === "on",
        currency: fd.get("currency") || defaultCurrency,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? tErrors("generic"));
      return;
    }
    setOpen(false);
    router.push(`/wishlist/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!requireOnline()) return;
          setOpen(true);
        }}
        className="pixel-font text-xs leading-normal underline underline-offset-4 sm:text-sm"
        title={!online ? tCommon("noConnection") : undefined}
      >
        {t("createButton")}
      </button>

      {open && (
        <ModalDialog onClose={() => setOpen(false)}>
          <h2 className="display-font mb-4 text-center text-sm md:text-base">
            {t("createTitle")}
          </h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="wishlist-title" className="pixel-font mb-2 block text-xs">
                {t("name")}
              </label>
              <input
                id="wishlist-title"
                name="title"
                required
                className="input-field"
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="wishlist-deadline" className="pixel-font mb-2 block text-xs">
                {t("deadline")}
              </label>
              <input id="wishlist-deadline" name="deadline" type="date" className="input-field" />
            </div>
            <div>
              <label htmlFor="wishlist-currency" className="pixel-font mb-2 block text-xs">
                {tCurrency("label")}
              </label>
              <select
                id="wishlist-currency"
                name="currency"
                defaultValue={defaultCurrency}
                className="input-field"
              >
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {tCurrency(code)}
                  </option>
                ))}
              </select>
              <p className="mono-font mt-1 text-sm text-[#777]">{tCurrency("hint")}</p>
            </div>
            <label htmlFor="wishlist-public" className="mono-font flex items-center gap-2 text-lg">
              <input
                id="wishlist-public"
                type="checkbox"
                name="isPublic"
                className="h-4 w-4 accent-black"
              />
              {t("publicList")}
            </label>
            {error && <p className="text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !online}
                className="btn-primary flex-1"
                title={!online ? tCommon("noConnection") : undefined}
              >
                {tCommon("create")}
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setOpen(false)}>
                {tCommon("back")}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </>
  );
}
