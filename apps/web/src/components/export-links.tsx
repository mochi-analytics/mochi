import { Download } from "lucide-react";

/** "Export CSV · JSON" links against the export API, placed next to a RangePicker. */
export function ExportLinks({
  botId,
  data,
  range,
}: {
  botId: string;
  data: "commands" | "custom" | "guilds" | "raw";
  range: string;
}) {
  const base = `/api/bots/${botId}/export?data=${data}&range=${range}`;
  const linkClass =
    "underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600 dark:decoration-zinc-600 dark:hover:decoration-zinc-300";
  return (
    <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <Download className="h-3.5 w-3.5" aria-hidden />
      Export{" "}
      <a href={base} download className={linkClass}>
        CSV
      </a>{" "}
      ·{" "}
      <a href={`${base}&format=json`} download className={linkClass}>
        JSON
      </a>
    </span>
  );
}
