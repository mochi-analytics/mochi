import Script from "next/script";
import { buttonClass } from "@/components/auth-card";

export function DiscordAuthForm({ siteKey }: { siteKey?: string }) {
  if (!siteKey) {
    return (
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
        Discord sign-in is not configured on this instance.
      </p>
    );
  }

  return (
    <form action="/api/auth/discord/start" method="POST" className="space-y-4">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div
        className="cf-turnstile flex min-h-[65px] justify-center"
        data-sitekey={siteKey}
        data-action="discord_oauth"
        data-theme="auto"
      />
      <button type="submit" className={buttonClass}>
        Continue with Discord
      </button>
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        Discord must report a verified email address. Mochi never receives your
        Discord password.
      </p>
    </form>
  );
}
