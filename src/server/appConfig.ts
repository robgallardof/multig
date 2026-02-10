const WPLACE_SCRIPT_DEFAULT =
  "https://github.com/SoundOfTheSky/wplace-bot/raw/refs/heads/main/dist.user.js";

function readEnvFlag(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export const AppConfig = {
  wplaceEnabled: readEnvFlag(process.env.WPLACE_ENABLED),
  wplaceScriptUrl: (process.env.WPLACE_TAMPERMONKEY_SCRIPT_URL || "").trim() || WPLACE_SCRIPT_DEFAULT,
  devtoolsEnabled: readEnvFlag(process.env.CAMOUFOX_DEVTOOLS) || readEnvFlag(process.env.WPLACE_DEVTOOLS),
};
