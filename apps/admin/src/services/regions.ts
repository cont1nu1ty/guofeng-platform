import { api } from "./http";
export interface RegionNode {
  id: string;
  parentId: string;
  provinceId: string;
  level: number;
  name: string;
  nameEn: string;
  officialCode: string;
  source: string;
  enabled: boolean;
  version: number;
}
export const regionChildren = async (parentId = "", admin = true) =>
  (
    await api<{ items: RegionNode[] }>(
      `${admin ? "/admin/regions" : "/regions/children"}?parentId=${encodeURIComponent(parentId)}`,
    )
  ).items;
export const saveRegion = (data: Record<string, unknown>, key: string) =>
  api<RegionNode>("/admin/regions", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(data),
  });
export interface VenueArea {
  venueId: string;
  version: number;
  area: RegionNode | null;
  coordinateSystem: string;
}
export const venueArea = (id: string) =>
  api<VenueArea>(`/admin/regions/venues/${encodeURIComponent(id)}`);
export const saveVenueArea = (
  id: string,
  areaId: string,
  version: number,
  coordinateSystem: string,
  key: string,
) =>
  api<VenueArea>(`/admin/regions/venues/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ areaId, version, coordinateSystem }),
  });
