import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allRegionNames,
  analyticsRegionNames,
  demoRegionNames,
  regionCatalog,
} from "../src/domain/regions";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("region catalog and analytics scope", () => {
  it("matches every backend region ID and name, including overseas", () => {
    const backend = readFileSync(
      new URL(
        "../../server/ruoyi-modules/ruoyi-jiafeng/src/main/java/org/dromara/jiafeng/Jf.java",
        import.meta.url,
      ),
      "utf8",
    );
    const values = (constant: string) => {
      const declaration = backend.match(
        new RegExp(`${constant} =\\s*List\\.of\\(([\\s\\S]*?)\\);`),
      );
      expect(declaration).not.toBeNull();
      return [...declaration![1]!.matchAll(/"([^"]+)"/g)].map(
        (match) => match[1],
      );
    };
    expect(regionCatalog.map((region) => region.id)).toEqual(
      values("REGION_IDS"),
    );
    expect(allRegionNames).toEqual(values("REGION_NAMES"));
    expect(regionCatalog).toHaveLength(35);
    expect(new Set(regionCatalog.map((region) => region.id)).size).toBe(35);
    expect(new Set(allRegionNames).size).toBe(35);
    expect(regionCatalog.at(-1)).toEqual({ id: "overseas", name: "海外" });
  });

  it("shows all 35 regions for national administrators and allows narrowing", () => {
    const user = { roles: ["national_admin"], regionIds: [] };
    expect(analyticsRegionNames(true, user, "全国")).toEqual(allRegionNames);
    expect(analyticsRegionNames(true, user, "海外")).toEqual(["海外"]);
  });

  it("does not create unauthorized zero-value rows for regional accounts", () => {
    const user = {
      roles: ["regional_admin"],
      regionIds: ["zhejiang", "overseas", "unknown", "zhejiang"],
    };
    expect(analyticsRegionNames(true, user, "全国")).toEqual([
      "浙江省",
      "海外",
    ]);
    expect(analyticsRegionNames(true, user, "浙江省")).toEqual(["浙江省"]);
    expect(analyticsRegionNames(true, user, "北京市")).toEqual([]);
    expect(analyticsRegionNames(true, user, "unknown")).toEqual([]);
    expect(analyticsRegionNames(true, null, "全国")).toEqual([]);
    expect(
      analyticsRegionNames(
        true,
        { roles: ["regional_admin"], regionIds: ["all", "unknown"] },
        "全国",
      ),
    ).toEqual([]);
  });

  it("preserves the five demo regions independently of the session", () => {
    expect(analyticsRegionNames(false, null, "全国")).toEqual([
      "北京市",
      "浙江省",
      "四川省",
      "江苏省",
      "广东省",
    ]);
    expect(analyticsRegionNames(false, null, "广东省")).toEqual(["广东省"]);
    expect(analyticsRegionNames(false, null, "海外")).toEqual([]);
  });

  it("offers the full HTTP selector while keeping the demo selector unchanged", async () => {
    vi.stubEnv("VITE_DATA_MODE", "http");
    vi.resetModules();
    expect((await import("../src/domain/workspace")).regions).toEqual([
      "全国",
      ...allRegionNames,
    ]);
    expect((await import("../src/domain/editorial")).editorialRegions).toEqual([
      "全国",
      ...allRegionNames,
    ]);
    expect((await import("../src/domain/operations")).regions).toEqual([
      "全国",
      ...allRegionNames,
    ]);
    vi.stubEnv("VITE_DATA_MODE", "demo");
    vi.resetModules();
    expect((await import("../src/domain/workspace")).regions).toEqual([
      "全国",
      ...demoRegionNames,
    ]);
    expect((await import("../src/domain/editorial")).editorialRegions).toEqual([
      "全国",
      ...demoRegionNames,
    ]);
    expect((await import("../src/domain/operations")).regions).toEqual(demoRegionNames);
  });
});
