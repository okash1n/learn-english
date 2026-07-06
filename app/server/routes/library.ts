import type { LibraryStore } from "../db";
import { json, exact, type RouteEntry } from "./http";

export type LibraryRoutesDeps = {
  /** モデルトークの記録と一覧（実体は db.ts、テストはフェイク/インメモリ） */
  libraryStore: LibraryStore;
};

export function makeLibraryRoutes(deps: LibraryRoutesDeps): RouteEntry[] {
  return [
    exact("GET", "/api/library/model-talks", () => json({ entries: deps.libraryStore.listModelTalks() })),
  ];
}
