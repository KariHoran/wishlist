export function ProgressBar({
  percent,
  segmented = false,
  className = "",
  height = 18,
}: {
  percent: number;
  segmented?: boolean;
  className?: string;
  height?: number;
}) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={`progress-track ${className}`} style={{ height }}>
      <div
        className={segmented ? "progress-fill-segmented" : "progress-fill"}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}
