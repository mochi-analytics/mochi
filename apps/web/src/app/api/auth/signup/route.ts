import { jsonError } from "@/lib/api";
import { isCloud } from "@/lib/deployment";

/** Password self-registration was replaced by verified Discord OAuth. */
export async function POST() {
  if (!isCloud()) return jsonError(404, "Signups are disabled on this instance");
  return jsonError(410, "Use Discord to create a cloud account");
}
