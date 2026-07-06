import type { Settings } from "../settings";
import { json, parseJsonBody, exact, type RouteEntry } from "./http";

export type SettingsRoutesDeps = {
  getSettings: () => Settings;
  saveSettings: (s: Settings) => void;
};

async function handleSettingsPut(req: Request, deps: SettingsRoutesDeps): Promise<Response> {
  const parsed = await parseJsonBody<{ anchor?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const anchor = parsed.body.anchor;
  if (typeof anchor !== "string" || anchor.length > 200) {
    return json({ error: "anchor must be a string of at most 200 characters" }, 400);
  }
  deps.saveSettings({ anchor });
  return json({ ok: true });
}

export function makeSettingsRoutes(deps: SettingsRoutesDeps): RouteEntry[] {
  return [
    exact("GET", "/api/settings", () => json(deps.getSettings())),
    exact("PUT", "/api/settings", (req) => handleSettingsPut(req, deps)),
  ];
}
