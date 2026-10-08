<script setup lang="ts">
import { isHttpMode } from '../../config/dataMode'
import { commerceStatusLabels } from '../../domain/showcaseCatalog'
import { readInputValue } from '../../composables/readInputValue'
import { computed, reactive, ref, watch } from 'vue'
import SectionHeading from '../../components/SectionHeading.vue'
import ConsultationHistory from './ConsultationHistory.vue'
import {
  culturalProducts,
  validateCommerceForm,
  type BilingualText,
  type CommerceKind,
  type CommerceRequest,
} from '../../domain/showcaseCatalog'
import {
  commerceRequests,
  showcaseStorageError,
  createCommerceRequest,
  cancelCommerceRequest,
} from '../../composables/useShowcase'
import { navigate, goBack, useRouteParams } from '../../composables/useNavigation'
import { t } from '../../composables/useLocale'
const params = useRouteParams()
const lt = (value: BilingualText) => t(value.zh, value.en)
const current = computed(() => culturalProducts.find((product) => product.id === params.value.id))
const filter = ref('all')
const mode = ref<CommerceKind>('public')
const formOpen = ref(false)
const formEditorVersion = ref(0)
const result = ref<CommerceRequest | null>(null)
const validationError = ref('')
const submitting = ref(false)
const form = reactive({ organization: '', quantity: '20', purpose: '', agreed: false })
const visibleProducts = computed(() =>
  culturalProducts.filter(
    (product) => filter.value === 'all' || product.kind === filter.value || product.kind === 'both',
  ),
)
const recordsMode = computed(() => params.value.view === 'records')
const activeRecords = computed(
  () => commerceRequests.value.filter((request) => request.status !== 'cancelled').length,
)
const productName = (id: string) => {
  const product = culturalProducts.find((item) => item.id === id)
  return product ? lt(product.name) : id
}
const errorMessages = computed<Record<string, string>>(() => ({
  organization: t(
    '请填写至少 2 个字的示例学校或机构名称。',
    'Enter an example organisation name with at least 2 characters.',
  ),
  quantity: t('请填写 1 至 500 之间的整数数量。', 'Enter a whole number between 1 and 500.'),
  purpose: t(
    '请用至少 8 个字说明示例用途。',
    'Describe the sample purpose in at least 8 characters.',
  ),
  agreement: t('请确认已了解本机演示说明。', 'Confirm that you understand this is a local demo.'),
  'showcase-storage': t(
    '本机存储不可用，记录未保存，请检查存储权限。',
    'Storage is unavailable. The request was not saved.',
  ),
}))
watch(
  () => [params.value.id, params.value.view],
  () => {
    formOpen.value = false
    result.value = null
    validationError.value = ''
    submitting.value = false
  },
)
function openForm(kind: CommerceKind) {
  mode.value = kind
  formOpen.value = true
  result.value = null
  validationError.value = ''
  form.agreed = false
}
async function submitRequest() {
  if (!current.value || submitting.value || result.value) return
  const validation = validateCommerceForm(form)
  if (validation) {
    validationError.value = validation
    return
  }
  submitting.value = true
  try {
    result.value = await createCommerceRequest(current.value.id, mode.value, form)
    formOpen.value = false
    validationError.value = ''
  } catch (error) {
    validationError.value = error instanceof Error ? error.message : 'showcase-storage'
  } finally {
    submitting.value = false
  }
}
async function cancel(id: string) {
  try {
    await cancelCommerceRequest(id)
    uni.showToast({ title: isHttpMode ? t('申请已取消', 'Request cancelled') : t('已取消本机演示记录', 'Local demo request cancelled'), icon: 'none' })
  } catch {
    uni.showToast({ title: errorMessages.value['showcase-storage'], icon: 'none' })
  }
}
function fillExample() {
  formEditorVersion.value++
  form.organization = t('向阳社区（示例）', 'Sunshine community (sample)')
  form.quantity = '20'
  form.purpose =
    mode.value === 'public'
      ? t(
          '用于周末家风共读活动，面向社区家庭开展公益阅读。',
          'For a weekend community reading session with local families.',
        )
      : t(
          '用于家风主题活动纪念，计划定制机构主题页和纪念文字。',
          'For a family heritage event with a themed organisation page and commemorative text.',
        )
}
</script>

<template>
  <view class="showcase-view">
    <template v-if="recordsMode">
      <view class="showcase-breadcrumb">
        <wd-button size="small" variant="plain" @click="goBack()">
          {{ t('返回', 'Back') }}
        </wd-button>
        <text>{{ t('文创商城 / 我的记录', 'Cultural gifts / My records') }}</text>
      </view>
      <SectionHeading
        :title="t('我的公益申领与定制咨询', 'My community requests and inquiries')"
        :subtitle="
          t(
            isHttpMode ? '申请记录保存在当前账号，由平台处理公益审核与发放或定制咨询；本次不涉及付款或物流对接。' : '每一条记录只保存在当前设备，没有真实配送或付款。',
            isHttpMode ? 'Requests are saved to your account for community-request processing or custom inquiries. Payment and shipping integrations are not included.' : 'Records are stored on this device. There is no delivery or payment.',
          )
        "
      />
      <view class="shop-record-summary">
        <text>{{ activeRecords }}</text>
        <view>
          {{ isHttpMode ? t('条未取消记录', 'non-cancelled records') : t('条有效演示记录', 'active demo requests') }}
          <text class="showcase-note">
            {{ isHttpMode ? t('点击记录查看当前处理与跟进', 'Open a record to view progress and follow-up') : t('状态用于沟通页面流程', 'Statuses illustrate the interface flow') }}
          </text>
        </view>
      </view>
      <view v-if="!commerceRequests.length" class="empty-state">
        {{
          t('还没有记录，先选择一份家风文创。', 'No requests yet. Explore a cultural gift first.')
        }}
        <wd-button size="small" @click="navigate('shop')">
          {{ t('浏览文创', 'Browse gifts') }}
        </wd-button>
      </view>
      <view
        v-for="request in commerceRequests"
        :key="request.id"
        class="showcase-panel shop-record"
      >
        <view class="showcase-row-between">
          <text class="showcase-kicker">
            {{
              request.kind === 'public'
                ? (isHttpMode ? t('公益申领', 'Community request') : t('公益申领 · 演示', 'Community request · demo'))
                : (isHttpMode ? t('定制咨询', 'Custom inquiry') : t('定制咨询 · 演示', 'Custom inquiry · demo'))
            }}
          </text>
          <text :class="['shop-status', { cancelled: request.status === 'cancelled' }]">
            {{
              isHttpMode
                ? (request.kind === 'custom' && request.status !== 'cancelled' ? t('查看咨询跟进', 'View inquiry progress') : commerceStatusLabels[request.status])
                : request.status === 'cancelled'
                  ? t('已取消', 'Cancelled')
                  : t('已记录，待沟通', 'Recorded for discussion')
            }}
          </text>
        </view>
        <text class="showcase-card-title">{{ productName(request.productId) }}</text>
        <text>{{ request.organization }} · {{ request.quantity }} {{ t('份', 'copies') }}</text>
        <text class="showcase-description">{{ request.purpose }}</text>
        <text class="showcase-note" selectable>
          {{ request.id }} · {{ request.createdAt.slice(0, 10) }}
        </text>
        <ConsultationHistory v-if="isHttpMode && request.kind === 'custom'" :claim-id="request.id" :cancelled="request.status === 'cancelled'" />
        <view class="showcase-actions">
          <wd-button
            size="small"
            variant="plain"
            @click="navigate('shop', { id: request.productId })"
          >
            {{ t('查看商品', 'View product') }}
          </wd-button>
          <wd-button
            v-if="request.status === 'recorded'"
            size="small"
            variant="plain"
            @click="cancel(request.id)"
          >
            {{ isHttpMode ? t('取消申请', 'Cancel request') : t('取消演示记录', 'Cancel demo request') }}
          </wd-button>
        </view>
      </view>
    </template>
    <template v-else-if="current">
      <view class="showcase-breadcrumb">
        <wd-button size="small" variant="plain" @click="goBack()">
          {{ t('返回文创', 'Back to gifts') }}
        </wd-button>
        <text>{{ lt(current.category) }}</text>
      </view>
      <view class="shop-product-detail">
        <view :class="['shop-product-art', 'shop-product-' + current.id]">
          <view class="shop-product-object">
            <text class="shop-product-mark">{{ current.mark }}</text>
            <text class="shop-product-small">家风中华行</text>
          </view>
          <text class="shop-art-note">
            {{ t('原创商品示意 · 非实物照片', 'Original illustration · not a product photograph') }}
          </text>
        </view>
        <view class="shop-product-copy">
          <text class="showcase-kicker">{{ lt(current.category) }}</text>
          <text class="showcase-title">{{ lt(current.name) }}</text>
          <text class="showcase-description">{{ lt(current.description) }}</text>
          <text class="shop-specification">{{ lt(current.specification) }}</text>
          <view class="shop-detail-points">
            <text v-for="(line, index) in current.details" :key="index">{{ lt(line) }}</text>
          </view>
          <view class="showcase-actions">
            <wd-button v-if="current.kind !== 'custom'" @click="openForm('public')">
              {{ t('公益申领', 'Community request') }}
            </wd-button>
            <wd-button
              v-if="current.kind !== 'public'"
              :variant="current.kind === 'both' ? 'plain' : 'base'"
              @click="openForm('custom')"
            >
              {{ t('商业定制咨询', 'Custom inquiry') }}
            </wd-button>
          </view>
          <text class="showcase-note">
            {{
              t(
                isHttpMode
                  ? '提交后由平台处理，进度可在个人中心查看。'
                  : '本次为前端流程演示，填写示例信息即可。',
                'This is a frontend workflow demo. Please use example information.',
              )
            }}
          </text>
        </view>
      </view>
      <view v-if="formOpen" class="showcase-panel shop-form" id="commerce-form">
        <view class="showcase-row-between">
          <view>
            <text class="showcase-card-title">
              {{
                mode === 'public'
                  ? t('填写公益申领信息', 'Community request form')
                  : t('填写定制需求', 'Custom inquiry form')
              }}
            </text>
            <text class="showcase-note">
              {{
                t(
                  '无需电话和收货地址；只使用示例机构信息。',
                  'Use an example organisation. No phone number or address is needed.',
                )
              }}
            </text>
          </view>
          <wd-button size="small" variant="plain" @click="fillExample">
            {{ t('填入示例', 'Fill example') }}
          </wd-button>
        </view>
        <view class="shop-form-grid">
          <view>
            <text class="showcase-field-label">
              {{ t('学校 / 社区 / 机构名称', 'School / community / organisation') }}
            </text>
            <input
              @blur="form.organization = readInputValue($event, form.organization)"
              @confirm="form.organization = readInputValue($event, form.organization)"
              v-model="form.organization"
              :key="formEditorVersion"
              class="showcase-input"
              :maxlength="60"
              :placeholder="t('请输入示例机构名称', 'Example organisation name')"
            />
          </view>
          <view>
            <text class="showcase-field-label">
              {{ t('意向数量（1–500 份）', 'Quantity (1–500 copies)') }}
            </text>
            <input
              @blur="form.quantity = readInputValue($event, form.quantity)"
              @confirm="form.quantity = readInputValue($event, form.quantity)"
              v-model="form.quantity"
              :key="formEditorVersion"
              class="showcase-input"
              type="number"
              :maxlength="3"
            />
          </view>
        </view>
        <text class="showcase-field-label">
          {{
            mode === 'public'
              ? t('公益用途说明', 'Community purpose')
              : t('定制主题与用途', 'Custom theme and purpose')
          }}
        </text>
        <textarea
          @blur="form.purpose = readInputValue($event, form.purpose)"
          @confirm="form.purpose = readInputValue($event, form.purpose)"
          v-model="form.purpose"
          :key="formEditorVersion"
          class="showcase-textarea"
          :maxlength="300"
          :placeholder="
            t('请填写至少 8 个字的示例用途', 'Describe the sample purpose in at least 8 characters')
          "
        />
        <wd-checkbox v-model="form.agreed" class="shop-form-agreement">
          {{
            t(
              isHttpMode
                ? '我同意将申请发送给平台处理。本次不产生报价、合同或付款。'
                : '我了解这只是本机演示，不产生真实申领、报价、合同或付款。',
              isHttpMode ? 'I agree to send this request to the platform. This does not create a quote, contract or payment.' : 'I understand this local demo creates no real request, quote, contract or payment.',
            )
          }}
        </wd-checkbox>
        <view v-if="validationError" class="showcase-form-error" role="alert">
          {{
            errorMessages[validationError] ||
            validationError ||
            t('提交未完成，请重新检查表单。', 'Submission failed. Check the form and try again.')
          }}
        </view>
        <view class="showcase-actions">
          <wd-button :loading="submitting" @click="submitRequest">
            {{
              mode === 'public'
                ? isHttpMode
                  ? t('提交申领', 'Submit request')
                  : t('提交演示申领', 'Save demo request')
                : isHttpMode
                  ? t('提交咨询', 'Submit inquiry')
                  : t('提交演示咨询', 'Save demo inquiry')
            }}
          </wd-button>
          <wd-button variant="plain" @click="formOpen = false">
            {{ t('收起表单', 'Close form') }}
          </wd-button>
        </view>
      </view>
      <view v-if="result" class="showcase-panel shop-result">
        <view class="shop-result-check"><wd-icon name="check" size="30px" /></view>
        <text class="showcase-title">
          {{
            isHttpMode
              ? t('申请已提交', 'Request submitted')
              : t('演示记录已保存', 'Demo request saved')
          }}
        </text>
        <text>
          {{
            t(
              '可以在“我的记录”查看或取消，刷新页面后仍保留。',
              'View or cancel it in My records. It remains available after a refresh.',
            )
          }}
        </text>
        <text class="shop-result-id" selectable>{{ result.id }}</text>
        <view class="shop-result-track">
          <view>
            <text>1</text>
            {{ t('填写信息', 'Fill form') }}
          </view>
          <view>
            <text>2</text>
            {{ isHttpMode ? t('账号记录', 'Account record') : t('本机记录', 'Save locally') }}
          </view>
          <view class="future">
            <text>3</text>
            {{ isHttpMode ? t('等待平台处理', 'Awaiting platform processing') : t('真实受理待接入', 'Service integration pending') }}
          </view>
        </view>
        <wd-button @click="navigate('shop', { view: 'records' })">
          {{ t('查看我的记录', 'View my records') }}
        </wd-button>
      </view>
    </template>
    <template v-else-if="params.id">
      <view class="empty-state">
        {{ t('没有找到这件文创', 'Product not found') }}
        <wd-button size="small" @click="navigate('shop')">
          {{ t('查看全部文创', 'Browse all gifts') }}
        </wd-button>
      </view>
    </template>
    <template v-else>
      <SectionHeading
        :title="t('把好家风，带进生活', 'Bring family heritage into daily life')"
        :eyebrow="t('家风文创 · 公益同行', 'CULTURAL GIFTS · SHARED HERITAGE')"
        :subtitle="
          t(
            '一册共读、一封家书、一枚书签，让文化有可触摸的温度。',
            'A shared book, a letter, a bookmark — meaningful objects for everyday life.',
          )
        "
      >
        <wd-button variant="plain" size="small" @click="navigate('shop', { view: 'records' })">
          {{ t('我的记录', 'My records') }} · {{ commerceRequests.length }}
        </wd-button>
      </SectionHeading>
      <view class="shop-route-grid">
        <view class="shop-route-public">
          <text class="showcase-kicker">{{ t('公益申领', 'COMMUNITY REQUESTS') }}</text>
          <text class="showcase-title">
            {{ t('让共读，走进更多家庭', 'Make room for shared reading') }}
          </text>
          <text>
            {{
              t(
                '学校、社区与公益活动的文化读本申领。',
                'Reading materials for schools, communities and volunteer activities.',
              )
            }}
          </text>
          <wd-button size="small" variant="plain" @click="filter = 'public'">
            {{ t('查看公益文创', 'View community gifts') }}
          </wd-button>
        </view>
        <view class="shop-route-custom">
          <text class="showcase-kicker">{{ t('商业定制', 'CUSTOM EDITIONS') }}</text>
          <text class="showcase-title">
            {{ t('让记忆，有专属的模样', 'Give memories a personal form') }}
          </text>
          <text>
            {{
              t(
                '记录机构、家庭与主题活动的文化心意。',
                'Explore themed editions for organisations, families and events.',
              )
            }}
          </text>
          <wd-button size="small" variant="plain" @click="filter = 'custom'">
            {{ t('了解定制咨询', 'Explore custom editions') }}
          </wd-button>
        </view>
      </view>
      <view class="showcase-filter">
        <wd-button
          v-for="item in [
            { id: 'all', label: t('全部文创', 'All gifts') },
            { id: 'public', label: t('公益申领', 'Community') },
            { id: 'custom', label: t('商业定制', 'Custom') },
          ]"
          :key="item.id"
          size="small"
          :variant="filter !== item.id ? 'plain' : 'base'"
          @click="filter = item.id"
        >
          {{ item.label }}
        </wd-button>
      </view>
      <view class="showcase-grid">
        <view
          v-for="product in visibleProducts"
          :key="product.id"
          class="showcase-card shop-product-card"
          @click="navigate('shop', { id: product.id })"
        >
          <view :class="['shop-product-art', 'shop-product-' + product.id]">
            <view class="shop-product-object">
              <text class="shop-product-mark">{{ product.mark }}</text>
              <text class="shop-product-small">家风中华行</text>
            </view>
            <text class="shop-art-note">{{ t('原创示意', 'Original illustration') }}</text>
          </view>
          <view class="showcase-card-body">
            <text class="showcase-kicker">{{ lt(product.category) }}</text>
            <text class="showcase-card-title">{{ lt(product.name) }}</text>
            <text class="showcase-description">{{ lt(product.description) }}</text>
            <view class="showcase-card-foot">
              <text>
                {{
                  product.kind === 'public'
                    ? t('公益申领', 'Community request')
                    : product.kind === 'custom'
                      ? t('定制咨询', 'Custom inquiry')
                      : t('公益 / 定制', 'Community / custom')
                }}
              </text>
              <text>{{ t('了解详情 →', 'View details →') }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="scope-note">
        {{
          t(
            '文创样例用于沟通公益与定制两种路径，没有实时库存、正式报价和支付功能。',
            'These samples demonstrate community and custom workflows, without live stock, formal quotes or payments.',
          )
        }}
      </view>
    </template>
    <view v-if="showcaseStorageError" class="scope-note">
      {{
        t(
          '本机存储不可用，申领和咨询记录无法保存。',
          'Storage is unavailable. Requests and inquiries cannot be saved.',
        )
      }}
    </view>
  </view>
</template>
