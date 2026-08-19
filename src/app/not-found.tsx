import { getTranslations } from "next-intl/server";
import { RetroStatePage } from "@/components/RetroState";

export default async function NotFound() {
  const t = await getTranslations("empty");
  const tCommon = await getTranslations("common");
  return (
    <RetroStatePage
      title={t("notFoundTitle")}
      variant="empty"
      message={t("notFound")}
      actionHref="/"
      actionLabel={tCommon("backToHome")}
    />
  );
}
