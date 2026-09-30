import { describe, expect, it } from "vitest";
import {
  beijingInput,
  beijingTime,
  windowInstant,
  windowError,
  scoreUnavailable,
} from "../src/domain/reviewWindow";
describe("评审时间输入与状态", () => {
  it("将北京时间转换为UTC，不依赖浏览器所在时区", () => {
    expect(windowInstant("2026-09-30 08:15:32")).toBe(
      "2026-09-30T00:15:32.000Z",
    );
    expect(beijingInput("2026-09-29T23:00:00Z")).toBe("2026-09-30 07:00:00");
    expect(beijingTime("2026-09-30T00:15:32Z")).toContain(
      "08:15:32（北京时间）",
    );
  });
  it("拒绝无效日历值、缺少时间及先截止后开始", () => {
    expect(windowInstant("2026-02-30 08:00:00")).toBe("");
    expect(windowError("2026-09-30", "2026-10-01")).not.toBe("");
    expect(windowError("2026-09-30 10:00:00", "2026-09-30 10:00:00")).not.toBe(
      "",
    );
    expect(windowError("2026-09-30 10:00:00", "2026-10-01 10:00:00")).toBe("");
  });
  it("提供未开始、逾期、无授权的具体禁止原因", () => {
    expect(
      scoreUnavailable({
        status: "待评分",
        windowStatus: "not_started",
        canScore: false,
      }),
    ).toContain("尚未开始");
    expect(
      scoreUnavailable({
        status: "待评分",
        windowStatus: "overdue",
        canScore: false,
      }),
    ).toContain("联系");
    expect(
      scoreUnavailable({
        status: "待评分",
        windowStatus: "active",
        canScore: false,
      }),
    ).toContain("当前账号");
  });
});
