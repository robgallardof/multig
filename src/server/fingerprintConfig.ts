import type { Profile } from "./profileTypes";
import { AppConfig } from "./appConfig";

type LocaleConfig = {
  locale: string;
  language: string;
  timezone: string;
  acceptLanguage: string;
};

type ProxyMeta = {
  countryCode?: string;
  cityName?: string;
};

const localeByCountry: Record<string, LocaleConfig> = {
  AR: { locale: "es-AR", language: "es-AR", timezone: "America/Argentina/Buenos_Aires", acceptLanguage: "es-AR,es;q=0.9,en;q=0.8" },
  BR: { locale: "pt-BR", language: "pt-BR", timezone: "America/Sao_Paulo", acceptLanguage: "pt-BR,pt;q=0.9,en;q=0.8" },
  CA: { locale: "en-CA", language: "en-CA", timezone: "America/Toronto", acceptLanguage: "en-CA,en;q=0.9,fr;q=0.7" },
  CL: { locale: "es-CL", language: "es-CL", timezone: "America/Santiago", acceptLanguage: "es-CL,es;q=0.9,en;q=0.8" },
  CO: { locale: "es-CO", language: "es-CO", timezone: "America/Bogota", acceptLanguage: "es-CO,es;q=0.9,en;q=0.8" },
  DE: { locale: "de-DE", language: "de-DE", timezone: "Europe/Berlin", acceptLanguage: "de-DE,de;q=0.9,en;q=0.8" },
  ES: { locale: "es-ES", language: "es-ES", timezone: "Europe/Madrid", acceptLanguage: "es-ES,es;q=0.9,en;q=0.8" },
  FR: { locale: "fr-FR", language: "fr-FR", timezone: "Europe/Paris", acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8" },
  GB: { locale: "en-GB", language: "en-GB", timezone: "Europe/London", acceptLanguage: "en-GB,en;q=0.9" },
  IT: { locale: "it-IT", language: "it-IT", timezone: "Europe/Rome", acceptLanguage: "it-IT,it;q=0.9,en;q=0.8" },
  MX: { locale: "es-MX", language: "es-MX", timezone: "America/Mexico_City", acceptLanguage: "es-MX,es;q=0.9,en;q=0.8" },
  PE: { locale: "es-PE", language: "es-PE", timezone: "America/Lima", acceptLanguage: "es-PE,es;q=0.9,en;q=0.8" },
  US: { locale: "en-US", language: "en-US", timezone: "America/New_York", acceptLanguage: "en-US,en;q=0.9" },
};

const osDefaults = {
  windows: {
    platform: "Win32",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    fonts: ["Segoe UI", "Arial", "Times New Roman", "Courier New"],
  },
  mac: {
    platform: "MacIntel",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:128.0) Gecko/20100101 Firefox/128.0",
    fonts: ["SF Pro Text", "Helvetica Neue", "Arial", "Menlo"],
  },
  linux: {
    platform: "Linux x86_64",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    fonts: ["Ubuntu", "DejaVu Sans", "Noto Sans", "Liberation Sans"],
  },
} as const;

export function buildCamoufoxOptions(profile: Profile, proxy?: ProxyMeta) {
  const osType = profile.osType ?? "windows";
  const os = osDefaults[osType] ?? osDefaults.windows;
  const camoufoxOs = osType === "mac" ? "macos" : osType;
  const countryCode = proxy?.countryCode ? proxy.countryCode.toUpperCase() : "US";
  const locale = localeByCountry[countryCode] ?? {
    locale: "en-US",
    language: "en-US",
    timezone: "UTC",
    acceptLanguage: "en-US,en;q=0.9",
  };

  return {
    os: camoufoxOs,
    fonts: os.fonts,
    locale: locale.locale,
    humanize: true,
    devtools: AppConfig.devtoolsEnabled,
    firefox_user_prefs: {
      "browser.privatebrowsing.autostart": false,
      "browser.tabs.autoHide": false,
      "browser.tabs.closeWindowWithLastTab": false,
      "browser.tabs.warnOnClose": false,
      "browser.tabs.warnOnCloseOtherTabs": false,
      "dom.disable_window_move_resize": false,
      "extensions.autoDisableScopes": 0,
      "extensions.enabledScopes": 15,
      "extensions.sideloading.enabled": true,
      "extensions.install.requireBuiltInCerts": false,
      "extensions.install.requireSecureOrigin": false,
      "extensions.langpacks.signatures.required": false,
      "extensions.allowPrivateBrowsingByDefault": true,
      "extensions.privatebrowsing.notification": false,
      "xpinstall.signatures.required": false,
      "xpinstall.whitelist.required": false,
      "privacy.clearOnShutdown.cache": false,
      "privacy.clearOnShutdown.cookies": false,
      "privacy.clearOnShutdown.offlineApps": false,
      "privacy.clearOnShutdown.sessions": false,
      "privacy.sanitize.sanitizeOnShutdown": false,
    },
  };
}
