import { isHttpMode } from '../config/dataMode'
import { command, remoteWorkspace } from '../services/api'
import { computed, ref } from 'vue'
import {
  culturalProducts,
  mediaCatalog,
  validateCommerceForm,
  type CommerceForm,
  type CommerceKind,
  type CommerceRequest,
} from '../domain/showcaseCatalog'

interface ShowcaseState {
  favorites: string[]
  likes: string[]
  requests: CommerceRequest[]
}
const storageKey = 'jiafeng:showcase:v1'
export const showcaseStorageError = ref(false)
const emptyState = (): ShowcaseState => ({ favorites: [], likes: [], requests: [] })

function readState(): ShowcaseState {
  try {
    const raw = uni.getStorageSync(storageKey)
    if (!raw) return emptyState()
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (typeof value !== 'object' || !value) throw new Error('invalid-state')
    const record = value as Partial<ShowcaseState>
    if (
      !Array.isArray(record.favorites) ||
      !Array.isArray(record.likes) ||
      !Array.isArray(record.requests)
    )
      throw new Error('invalid-state')
    return {
      favorites: record.favorites.filter((id) => mediaCatalog.some((item) => item.id === id)),
      likes: record.likes.filter((id) => mediaCatalog.some((item) => item.id === id)),
      requests: record.requests.filter(
        (request) =>
          request &&
          typeof request.id === 'string' &&
          culturalProducts.some((product) => product.id === request.productId) &&
          (request.kind === 'public' || request.kind === 'custom') &&
          typeof request.organization === 'string' &&
          Number.isInteger(request.quantity) &&
          request.quantity > 0 &&
          request.quantity <= 500 &&
          typeof request.purpose === 'string' &&
          typeof request.createdAt === 'string' &&
          (request.status === 'recorded' || request.status === 'cancelled'),
      ),
    }
  } catch {
    showcaseStorageError.value = true
    return emptyState()
  }
}

const state = ref<ShowcaseState>(isHttpMode ? emptyState() : readState())
export const mediaFavorites = computed(() =>
  isHttpMode ? remoteWorkspace.mediaFavorites : state.value.favorites,
)
export const mediaLikes = computed(() =>
  isHttpMode ? remoteWorkspace.mediaLikes : state.value.likes,
)
export const commerceRequests = computed(() =>
  [...(isHttpMode ? remoteWorkspace.commerceRequests : state.value.requests)].reverse(),
)

function writeState(next: ShowcaseState) {
  if (showcaseStorageError.value) throw new Error('showcase-storage')
  try {
    uni.setStorageSync(storageKey, JSON.stringify(next))
    state.value = next
  } catch {
    showcaseStorageError.value = true
    throw new Error('showcase-storage')
  }
}

function toggle(field: 'favorites' | 'likes', id: string) {
  if (!mediaCatalog.some((item) => item.id === id)) return
  const values = state.value[field]
  writeState({
    ...state.value,
    [field]: values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
  })
}

export function toggleMediaFavorite(id: string) {
  if (isHttpMode) return command('media.favorite', id)
  toggle('favorites', id)
}
export function toggleMediaLike(id: string) {
  if (isHttpMode) return command('media.like', id)
  toggle('likes', id)
}

export function createCommerceRequest(productId: string, kind: CommerceKind, form: CommerceForm) {
  const product = culturalProducts.find((item) => item.id === productId)
  if (!product || (product.kind !== 'both' && product.kind !== kind))
    throw new Error('invalid-product')
  const validation = validateCommerceForm(form)
  if (validation) throw new Error(validation)
  if (isHttpMode) {
    return command<CommerceRequest>('welfare.claim', productId, {
      kind,
      organization: form.organization.trim(),
      quantity: Number(form.quantity),
      purpose: form.purpose.trim(),
    }).then(
      (result) =>
        result || remoteWorkspace.commerceRequests[remoteWorkspace.commerceRequests.length - 1]!,
    )
  }
  const record: CommerceRequest = {
    id: `DEMO-${kind === 'public' ? 'G' : 'C'}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    productId,
    kind,
    organization: form.organization.trim(),
    quantity: Number(form.quantity),
    purpose: form.purpose.trim(),
    createdAt: new Date().toISOString(),
    status: 'recorded',
  }
  writeState({ ...state.value, requests: [...state.value.requests, record] })
  return record
}

export function cancelCommerceRequest(id: string) {
  if (isHttpMode) return command('welfare.cancel', id)
  writeState({
    ...state.value,
    requests: state.value.requests.map((request) =>
      request.id === id ? { ...request, status: 'cancelled' as const } : request,
    ),
  })
}
