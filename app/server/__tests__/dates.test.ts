import { describe, expect, test } from "bun:test";
import { addDaysYmd, localYmd } from "../dates";

describe("dates", () => {
  test("localYmd はローカル日付で YYYY-MM-DD", () => {
    expect(localYmd(new Date(2026, 6, 6))).toBe("2026-07-06"); // 月は0起点
    expect(localYmd(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
  test("addDaysYmd は月・年を跨いで加算できる", () => {
    expect(addDaysYmd("2026-07-30", 3)).toBe("2026-08-02");
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2026-07-06", -7)).toBe("2026-06-29");
  });
});
