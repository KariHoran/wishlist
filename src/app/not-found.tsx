import { RetroStatePage } from "@/components/RetroState";

export default function NotFound() {
  return (
    <RetroStatePage
      title="404"
      variant="empty"
      message="Упс! страница не найдена"
      actionHref="/"
      actionLabel="Вернуться на главную"
    />
  );
}
