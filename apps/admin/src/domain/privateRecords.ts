import { reactive } from "vue";

export interface PrivateRecordStats {
  recitations: number;
  familyPromises: number;
  byRegion: { regionId: string; recitations: number; familyPromises: number }[];
}
export const privateRecordStats = reactive<PrivateRecordStats>({
  recitations: 0, familyPromises: 0, byRegion: [],
});
