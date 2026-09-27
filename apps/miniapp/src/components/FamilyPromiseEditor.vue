<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ApiError, refreshWorkspace, remoteUser, remoteWorkspace } from '../services/api'
import { saveFamilyPromise, removeFamilyPromise } from '../services/cloudRecords'
import { validateFamilyPromise, type FamilyPromise } from '../domain/cloudRecords'
import { readInputValue } from '../composables/readInputValue'
import { t } from '../composables/useLocale'
const props = defineProps<{ personId: string; personName?: string }>()
const stored = computed(() =>
  remoteWorkspace.familyPromises.find((item) => item.personId === props.personId),
)
const text = ref('')
const previous = ref<FamilyPromise>()
const busy = ref(false)
const message = ref('')
const conflict = ref(false)
let generation = 0
function restore() {
  previous.value = stored.value ? { ...stored.value } : undefined
  text.value = stored.value?.text || ''
  conflict.value = false
}
watch(
  [() => props.personId, remoteUser],
  () => {
    generation++
    busy.value = false
    message.value = ''
    restore()
  },
  { immediate: true },
)
async function reload() {
  if (busy.value) return
  const current = generation
  busy.value = true
  try {
    await refreshWorkspace()
    if (generation !== current) return
    restore()
    message.value = t('已读取云端最新约定。', 'Loaded the latest saved promise.')
  } catch (error) {
    if (generation === current)
      message.value =
        error instanceof Error ? error.message : t('读取失败', 'Could not load the promise')
  } finally {
    if (generation === current) busy.value = false
  }
}
async function save() {
  if (busy.value || !remoteUser.value) return
  if (!validateFamilyPromise(text.value)) {
    message.value = t('请填写 4–180 字的家庭约定。', 'Write a promise of 4–180 characters.')
    return
  }
  const current = generation
  busy.value = true
  message.value = ''
  try {
    await saveFamilyPromise(props.personId, text.value, previous.value)
    if (generation !== current) return
    restore()
    message.value = t(
      '已保存到当前账号，仅你本人可读。',
      'Saved to your account. Only you can read it.',
    )
  } catch (error) {
    if (generation !== current) return
    conflict.value = error instanceof ApiError && [409, 412].includes(error.status)
    message.value = conflict.value
      ? t(
          '约定已在其他页面修改。本次文字仍保留，请先复制文字，再读取云端最新约定后合并。',
          'This promise changed elsewhere. Your text is preserved. Copy it before loading the latest version and merging your changes.',
        )
      : error instanceof Error
        ? error.message
        : t('保存失败，文字已保留。', 'Save failed. Your text is preserved.')
  } finally {
    if (generation === current) busy.value = false
  }
}
async function remove() {
  if (busy.value || !previous.value) return
  const current = generation
  busy.value = true
  try {
    await removeFamilyPromise(previous.value)
    if (generation !== current) return
    restore()
    message.value = t('云端约定已删除。', 'Saved promise deleted.')
  } catch (error) {
    if (generation === current)
      message.value = error instanceof Error ? error.message : t('删除失败', 'Deletion failed')
  } finally {
    if (generation === current) busy.value = false
  }
}
function readLegacy() {
  try {
    const value = uni.getStorageSync(`jiafeng:reflection:${props.personId}`)
    if (typeof value !== 'string' || !value.trim()) {
      message.value = t(
        '此设备没有对应的旧约定。',
        'This device has no earlier promise for this profile.',
      )
      return
    }
    text.value = value
    message.value = t(
      '已把旧设备约定填入编辑框，尚未上传。核对当前账号后，主动保存才会归入账号。',
      'The old device promise is in the editor and has not been uploaded. Check your account, then save to associate it with this account.',
    )
  } catch {
    message.value = t('无法读取旧设备约定。', 'Could not read the old device promise.')
  }
}
</script>
<template>
  <view class="promise-editor">
    <text v-if="personName" class="promise-name">{{ personName }}</text>
    <text class="promise-note">
      {{
        t(
          '家庭约定仅本人可读，不会提交后台审核或进入搜索。',
          'Only you can read your promise. It is not sent for review or included in search.',
        )
      }}
    </text>
    <text v-if="stored?.targetAvailable === false" class="promise-note">
      {{
        t(
          '人物资料已下架，你仍可管理这份约定。',
          'This profile is no longer published. You can still manage your promise.',
        )
      }}
    </text>
    <textarea
      v-model="text"
      :disabled="busy || !remoteUser"
      maxlength="180"
      class="promise-input"
      :placeholder="
        t(
          '例如：每周留出一晚，和家人共读一封家书。',
          'For example: read a family letter together one evening a week.',
        )
      "
      @blur="text = readInputValue($event, text)"
      @confirm="text = readInputValue($event, text)"
    />
    <view class="promise-actions">
      <wd-button size="small" :disabled="busy || !remoteUser || conflict" @click="save">
        {{ busy ? t('处理中…', 'Working…') : t('保存我的约定', 'Save my promise') }}
      </wd-button>
      <wd-button size="small" variant="plain" :disabled="busy || !remoteUser" @click="reload">
        {{ t('读取云端最新约定', 'Load latest promise') }}
      </wd-button>
      <wd-button v-if="previous" size="small" variant="plain" :disabled="busy" @click="remove">
        {{ t('删除约定', 'Delete promise') }}
      </wd-button>
      <wd-button size="small" variant="plain" :disabled="busy || !remoteUser" @click="readLegacy">
        {{ t('填入旧设备约定', 'Use old device text') }}
      </wd-button>
    </view>
    <text v-if="!remoteUser" class="promise-note">
      {{ t('请先在个人中心登录。', 'Sign in through My account first.') }}
    </text>
    <text v-if="message" class="promise-note" role="status">{{ message }}</text>
  </view>
</template>
<style scoped>
.promise-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0;
  min-width: 0;
}
.promise-name {
  font-size: 18px;
  font-weight: 600;
}
.promise-note {
  font-size: 14px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.promise-input {
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--jf-border);
  background: var(--jf-surface);
  font-size: 16px;
}
.promise-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
