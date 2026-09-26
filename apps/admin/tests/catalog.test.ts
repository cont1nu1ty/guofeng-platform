import { describe, expect, it } from "vitest";
import {
  newCatalogDraft,
  validateCatalog,
  catalogPayload,
} from "../src/domain/catalog";
import { validateContent } from "../src/domain/editorial";

describe("catalog editing boundaries", () => {
  it("sends only editable fields and preserves independent English, region, and explicit sample metadata", () => {
    const form = {
      ...newCatalogDraft("banners", "浙江省"),
      title: "A letter home",
      language: "en",
      sample: true,
      owner: "private",
      status: "已发布",
      lockVersion: 19,
      startsAt: "2026-10-01T09:00:00+08:00",
      endsAt: "2026-10-02T09:00:00+08:00",
    };
    expect(validateCatalog("banners", form)).toBe("");
    const result = catalogPayload("banners", form);
    expect(result).toMatchObject({
      language: "en",
      region: "浙江省",
      sample: true,
      startsAt: "2026-10-01T01:00:00.000Z",
    });
    expect(result).not.toHaveProperty("owner");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("lockVersion");
  });
  it("rejects backwards publication windows and incomplete or out-of-range navigation coordinates", () => {
    expect(
      validateCatalog("banners", {
        ...newCatalogDraft("banners", "全国"),
        title: "时间错误",
        startsAt: "2026-10-02T00:00:00Z",
        endsAt: "2026-10-01T00:00:00Z",
      }),
    ).toContain("结束时间");
    const venue = {
      ...newCatalogDraft("venues", "浙江省"),
      title: "阅读阵地",
      city: "杭州",
      address: "展示地址",
      description: "共读介绍",
      latitude: 30,
    };
    expect(validateCatalog("venues", venue)).toContain("经纬度");
    expect(validateCatalog("venues", { ...venue, longitude: 190 })).toContain("经纬度");
    expect(validateCatalog("venues", { ...venue, longitude: 120 })).toBe("");
    expect(
      catalogPayload("venues", { ...venue, latitude: "", longitude: "" }),
    ).toMatchObject({ latitude: null, longitude: null });
  });
  it("rejects non-HTTPS external sources and invalid ordering", () => {
    const hall = {
      ...newCatalogDraft("hallPeople", "全国"),
      title: "家风档案",
      theme: "守信",
      introduction: "人物资料",
      sourceTitle: "原创资料",
      sourceUrl: "javascript:alert(1)",
    };
    expect(validateCatalog("hallPeople", hall)).toContain("HTTPS");
    expect(
      validateCatalog("hallPeople", {
        ...hall,
        sourceUrl: "https://example.org/",
        sortOrder: 0.5,
      }),
    ).toContain("整数");
  });
  it("accepts actual API language values and industry/topic editing without invented translations", () => {
    const draft = {
      title: "行业交流资料",
      category: "行业动态" as const,
      region: "全国",
      language: "英文",
      topic: "classical" as const,
      summary: "Editorial notes.",
      body: "Only this English version is being edited.",
    };
    expect(validateContent(draft)).toBe("");
  });
});
