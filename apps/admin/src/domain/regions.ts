// Keep IDs and names aligned with the backend Jf.REGION_IDS/REGION_NAMES.
export const regionCatalog = [
  { id: "beijing", name: "北京市" },
  { id: "tianjin", name: "天津市" },
  { id: "hebei", name: "河北省" },
  { id: "shanxi", name: "山西省" },
  { id: "inner-mongolia", name: "内蒙古自治区" },
  { id: "liaoning", name: "辽宁省" },
  { id: "jilin", name: "吉林省" },
  { id: "heilongjiang", name: "黑龙江省" },
  { id: "shanghai", name: "上海市" },
  { id: "jiangsu", name: "江苏省" },
  { id: "zhejiang", name: "浙江省" },
  { id: "anhui", name: "安徽省" },
  { id: "fujian", name: "福建省" },
  { id: "jiangxi", name: "江西省" },
  { id: "shandong", name: "山东省" },
  { id: "henan", name: "河南省" },
  { id: "hubei", name: "湖北省" },
  { id: "hunan", name: "湖南省" },
  { id: "guangdong", name: "广东省" },
  { id: "guangxi", name: "广西壮族自治区" },
  { id: "hainan", name: "海南省" },
  { id: "chongqing", name: "重庆市" },
  { id: "sichuan", name: "四川省" },
  { id: "guizhou", name: "贵州省" },
  { id: "yunnan", name: "云南省" },
  { id: "xizang", name: "西藏自治区" },
  { id: "shaanxi", name: "陕西省" },
  { id: "gansu", name: "甘肃省" },
  { id: "qinghai", name: "青海省" },
  { id: "ningxia", name: "宁夏回族自治区" },
  { id: "xinjiang", name: "新疆维吾尔自治区" },
  { id: "hong-kong", name: "香港特别行政区" },
  { id: "macao", name: "澳门特别行政区" },
  { id: "taiwan", name: "台湾省" },
  { id: "overseas", name: "海外" },
] as const;

export const allRegionNames = regionCatalog.map((region) => region.name);
export const demoRegionNames = [
  "北京市",
  "浙江省",
  "四川省",
  "江苏省",
  "广东省",
];

interface RegionScope {
  roles: readonly string[];
  regionIds: readonly string[];
}

export function defaultWorkspaceRegion(user: RegionScope | null): string {
  if (!user || user.roles.includes("national_admin")) return "全国";
  if (user.roles.includes("regional_admin")) {
    for (const id of user.regionIds) {
      const region = regionCatalog.find((item) => item.id === id);
      if (region) return region.name;
    }
  }
  return "全国";
}

export function analyticsRegionNames(
  httpMode: boolean,
  user: RegionScope | null,
  selectedRegion: string,
): string[] {
  const authorizedIds = new Set(user?.regionIds ?? []);
  const names = httpMode
    ? regionCatalog
        .filter(
          (region) =>
            user?.roles.includes("national_admin") ||
            authorizedIds.has(region.id),
        )
        .map((region) => region.name)
    : demoRegionNames;
  return names.filter(
    (name) => selectedRegion === "全国" || selectedRegion === name,
  );
}
