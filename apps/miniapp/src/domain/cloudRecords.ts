export interface CloudRecitation {
  id: string
  title: string
  category: 'reading'
  fileId: string
  fileName: string
  size: number
  duration: number
  createdAt: string
  updatedAt: string
  lockVersion: number
}
export interface FamilyPromise {
  id: string
  personId: string
  personName: string
  personLanguage: 'zh' | 'en'
  text: string
  targetAvailable: boolean
  createdAt: string
  updatedAt: string
  lockVersion: number
}
export function validateFamilyPromise(text: string) {
  const length = Array.from(text.trim()).length
  return length >= 4 && length <= 180
}
