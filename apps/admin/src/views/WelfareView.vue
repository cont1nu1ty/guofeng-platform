<script setup lang="ts">
import { isHttpMode, modeText } from "../services/mode";

import { toggleProduct, saveProduct, processClaim } from "../services/actions";

import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Search, Box, Present, Van } from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import ConsultationManager from "../components/ConsultationManager.vue";
import {
  products,
  welfareClaims,
  productTitle,
  type Product,
  type WelfareClaim,
} from "../domain/operations";
import { matchesRegion } from "../domain/workspace";
import { command, selectRecordCollection } from "../services/workspaceData";
import { regions } from "../domain/workspace";
const newProductOpen = ref(false);
const productForm = reactive({
  title: "",
  type: "公益文创",
  description: "",
  stock: 0,
  quota: 1,
  region: "全国",
});
async function createProduct() {
  if (
    productForm.title.trim().length < 2 ||
    productForm.description.trim().length < 5
  )
    return ElMessage.warning("请填写商品名称（至少2字）及介绍（至少5字）");
  await command("saveProduct", { ...productForm });
  newProductOpen.value = false;
  ElMessage.success("商品已保存");
}
const tab = ref("products"),
  query = ref(""),
  category = ref(""),
  claimStatus = ref("");
watch(tab, value => { void selectRecordCollection(value === "products" ? "products" : "welfareClaims"); });
const visibleProducts = computed(() =>
  products.filter(
    (item) =>
      (!query.value || item.title.includes(query.value.trim())) &&
      (!category.value || item.category === category.value),
  ),
);
const regionalClaims = computed(() =>
  welfareClaims.filter((item) => matchesRegion(item.region)),
);
const visibleClaims = computed(() =>
  regionalClaims.value.filter(
    (item) =>
      (!query.value ||
        `${item.id}${item.organization}${productTitle(item.productId)}`.includes(
          query.value.trim(),
        )) &&
      (!claimStatus.value || item.status === claimStatus.value),
  ),
);
const stockOpen = ref(false),
  currentProduct = ref<Product | null>(null),
  stockForm = reactive({ stock: 0, quota: 1 });
function editStock(item: Product) {
  currentProduct.value = item;
  stockForm.stock = item.stock;
  stockForm.quota = item.quota;
  stockOpen.value = true;
}
async function saveStock() {
  if (!currentProduct.value) return;
  const result = await saveProduct(
    currentProduct.value.id,
    stockForm.stock,
    stockForm.quota,
  );
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
  stockOpen.value = false;
}
async function changeProduct(item: Product) {
  await toggleProduct(item.id);
  ElMessage.success(`“${item.title}”状态已更新`);
}
const claimOpen = ref(false),
  currentClaim = ref<WelfareClaim | null>(null),
  returnNote = ref("");
const customClaim = computed(() => (currentClaim.value as (WelfareClaim & {kind?: string}) | null)?.kind === "custom");
function claimLabel(item: WelfareClaim) {
  const value=item as WelfareClaim & {kind?: string; consultationStage?: string};
  if(value.kind !== "custom" || value.status === "已取消") return value.status;
  return ({pending:"待受理",accepted:"已受理",discussion:"沟通中",quoted:"已报价",closed:"已结束"} as Record<string,string>)[value.consultationStage || "pending"] || "待受理";
}
function openClaim(item: WelfareClaim) {
  currentClaim.value = item;
  returnNote.value = "";
  claimOpen.value = true;
}
async function act(action: "approve" | "return" | "deliver") {
  if (!currentClaim.value) return;
  const result = await processClaim(
    currentClaim.value.id,
    action,
    returnNote.value,
  );
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
  claimOpen.value = false;
}
</script>
<template>
  <PageHeading
    title="文创与公益"
    description="让家风文化走进日常，让每一份公益心意有所抵达。"
    eyebrow="CULTURE & PUBLIC WELFARE"
    ><template #actions
      ><el-button
        v-if="isHttpMode"
        v-has-permi="'welfare:write'"
        type="primary"
        @click="newProductOpen = true"
        >新建文创资源</el-button
      ></template
    ></PageHeading
  >
  <div class="welfare-banner">
    <div>
      <span class="mini-label">以文化人 · 以物传情</span>
      <h2>一份文创，一段家风的传承</h2>
      <p>管理公益资源、申请额度与发放台账，串联学校与社区的文化共建。</p>
    </div>
    <div class="banner-seal">家<br />风</div>
  </div>
  <div class="stat-grid welfare-stats">
    <div class="stat-card">
      <el-icon><Present /></el-icon><span>文创品类</span
      ><strong>{{ products.length }}<small>款</small></strong>
    </div>
    <div class="stat-card">
      <el-icon><Box /></el-icon><span>待审核申领</span
      ><strong
        >{{ regionalClaims.filter((i) => i.status === "待审核" && (i as WelfareClaim & {kind?: string}).kind !== 'custom').length
        }}<small>笔</small></strong
      >
    </div>
    <div class="stat-card">
      <el-icon><Van /></el-icon><span>待发放申领</span
      ><strong
        >{{ regionalClaims.filter((i) => i.status === "待发放").length
        }}<small>笔</small></strong
      >
    </div>
  </div>
  <section class="panel">
    <el-tabs v-model="tab" @tab-change="query = ''"
      ><el-tab-pane label="文创资源" name="products" /><el-tab-pane
        label="申领与定制咨询"
        name="claims"
    /></el-tabs>
    <div class="filter-bar">
      <el-input
        v-model="query"
        :placeholder="
          tab === 'products' ? '搜索文创名称' : '搜索机构、编号或商品'
        "
        clearable
        :prefix-icon="Search"
        aria-label="搜索文创或申领"
      /><el-select
        v-if="tab === 'products'"
        v-model="category"
        placeholder="全部类别"
        clearable
        aria-label="商品分类"
        ><el-option label="公益文创" value="公益文创" /><el-option
          label="定制文创"
          value="定制文创" /></el-select
      ><el-select
        v-else
        v-model="claimStatus"
        placeholder="全部申领状态"
        clearable
        aria-label="申领状态"
        ><el-option
          v-for="item in ['待审核', '待发放', '已发放', '已退回']"
          :key="item"
          :value="item"
          :label="item"
      /></el-select>
    </div>
    <template v-if="tab === 'products'"
      ><div class="product-grid">
        <article
          v-for="item in visibleProducts"
          :key="item.id"
          class="product-card"
        >
          <div class="product-art" :style="{ '--product-color': item.color }">
            <span class="art-border"></span
            ><span class="art-character">{{ item.glyph }}</span
            ><span class="art-wordmark">家风中华行</span
            ><el-tag
              :type="item.status === '上架中' ? 'success' : 'info'"
              size="small"
              >{{ item.status }}</el-tag
            >
          </div>
          <div class="product-body">
            <span class="product-category">{{ item.category }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.subtitle }}</p>
            <div class="product-metrics">
              <div>
                <small>库存</small><b>{{ item.stock }}<em>件</em></b>
              </div>
              <div>
                <small>单次申领额度</small><b>{{ item.quota }}<em>件</em></b>
              </div>
            </div>
            <div class="product-actions">
              <el-button v-has-permi="'welfare:write'" @click="editStock(item)"
                >库存与额度</el-button
              ><el-button
                v-has-permi="'welfare:write'"
                link
                type="primary"
                @click="changeProduct(item)"
                >{{
                  ["上架中", "已上架"].includes(item.status) ? "下架" : "上架"
                }}</el-button
              >
            </div>
          </div>
        </article>
      </div>
      <el-empty
        v-if="!visibleProducts.length"
        description="没有找到文创资源，请调整筛选"
      />
      <p class="empty-note">
        {{
          modeText(
            "公益申领记录审核、库存与发放；定制咨询记录人工跟进和参考报价，支付、商业订单与物流另行确认。",
            "商品与库存均为预置样例。定制文创暂展示资源，不涉及报价、支付和实际订单。",
          )
        }}
      </p></template
    >
    <template v-else
      ><el-table :data="visibleClaims" row-key="id"
        ><el-table-column label="申领机构" min-width="210"
          ><template #default="{ row }"
            ><b class="institution">{{ row.organization }}</b><small>{{ row.kind === 'custom' ? '定制咨询' : '公益申领' }}</small
            ><small class="muted claim-id">{{ row.id }}</small></template
          ></el-table-column
        ><el-table-column
          prop="region"
          label="地区"
          width="100" /><el-table-column label="申领资源" min-width="170"
          ><template #default="{ row }">{{
            productTitle(row.productId)
          }}</template></el-table-column
        ><el-table-column
          prop="quantity"
          label="数量"
          width="80" /><el-table-column
          prop="date"
          label="申请日期"
          width="120" /><el-table-column label="状态" width="108"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.status === '待审核'
                  ? 'warning'
                  : row.status === '已退回'
                    ? 'danger'
                    : row.status === '已发放'
                      ? 'success'
                      : 'primary'
              "
              size="small"
              >{{ claimLabel(row) }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column label="操作" width="110" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openClaim(row)">{{
              row.kind === 'custom' ? '跟进咨询' : row.status === "待审核"
                ? "审核申请"
                : row.status === "待发放"
                  ? "处理发放"
                  : "查看台账"
            }}</el-button></template
          ></el-table-column
        ><template #empty
          ><el-empty description="当前地区没有符合条件的申领记录" /></template
      ></el-table>
      <div class="table-tools muted">
        共 {{ visibleClaims.length }} 笔申领 ·
        {{
          modeText(
            "确认发放会扣减库存并记录台账，物流配送不在当前系统处理。",
            "模拟发放会同步扣减本次会话库存，不产生实际配送。",
          )
        }}
      </div></template
    >
  </section>
  <el-dialog v-model="stockOpen" title="库存与公益额度" width="min(520px, 92vw)"
    ><p v-if="currentProduct" class="muted">{{ currentProduct.title }}</p>
    <el-form label-position="top"
      ><el-form-item label="库存（件）"
        ><el-input-number
          v-model="stockForm.stock"
          :min="0"
          :max="100000"
          :precision="0" /></el-form-item
      ><el-form-item label="单次申领额度（件）"
        ><el-input-number
          v-model="stockForm.quota"
          :min="1"
          :max="10000"
          :precision="0" /></el-form-item></el-form
    ><el-alert
      :title="
        modeText(
          '保存后更新真实库存与单次申领额度。',
          '这里只调整本次会话中的示例数值。',
        )
      "
      type="info"
      :closable="false"
    /><template #footer
      ><el-button @click="stockOpen = false">取消</el-button
      ><el-button
        v-has-permi="'welfare:write'"
        type="primary"
        @click="saveStock"
        >保存调整</el-button
      ></template
    ></el-dialog
  >
  <el-drawer v-model="claimOpen" :title="customClaim ? '定制咨询详情' : '公益申领详情'" size="min(620px, 100vw)" destroy-on-close
    ><template v-if="currentClaim"
      ><el-tag effect="plain">{{ currentClaim.id }}</el-tag>
      <h2 class="claim-title">{{ currentClaim.organization }}</h2>
      <el-descriptions :column="1" border
        ><el-descriptions-item label="所属地区">{{
          currentClaim.region
        }}</el-descriptions-item
        ><el-descriptions-item label="申领资源">{{
          productTitle(currentClaim.productId)
        }}</el-descriptions-item
        ><el-descriptions-item label="申领数量"
          >{{ currentClaim.quantity }} 件</el-descriptions-item
        ><el-descriptions-item label="申请日期">{{
          currentClaim.date
        }}</el-descriptions-item
        ><el-descriptions-item label="当前状态">{{
          claimLabel(currentClaim)
        }}</el-descriptions-item></el-descriptions
      >
      <h3 class="drawer-subtitle">申领用途</h3>
      <p class="drawer-copy">{{ currentClaim.purpose }}</p>
      <template v-if="currentClaim.note"
        ><h3 class="drawer-subtitle">处理备注</h3>
        <p class="drawer-copy">{{ currentClaim.note }}</p></template
      ><ConsultationManager v-if="isHttpMode && customClaim" :claim-id="currentClaim.id" /><template v-else-if="currentClaim.status === '待审核'"
        ><h3 class="drawer-subtitle">退回说明</h3>
        <el-input
          v-model="returnNote"
          type="textarea"
          :rows="3"
          placeholder="退回时必填，至少 5 字；通过时无需填写"
          maxlength="300"
          show-word-limit
        />
        <div class="drawer-actions">
          <el-button v-has-permi="'welfare:write'" @click="act('return')"
            >退回补充</el-button
          ><el-button
            v-has-permi="'welfare:write'"
            type="primary"
            @click="act('approve')"
            >通过审核</el-button
          >
        </div></template
      ><template v-else-if="currentClaim.status === '待发放'"
        ><el-alert
          class="delivery-note"
          :title="
            modeText(
              '确认后扣减库存并更新台账，不会自动创建物流单。',
              '处理后扣减库存并更新台账，无实际物流。',
            )
          "
          type="info"
          :closable="false"
        /><el-button
          v-has-permi="'welfare:write'"
          type="primary"
          @click="act('deliver')"
          >确认发放</el-button
        ></template
      ></template
    ></el-drawer
  >
  <el-dialog
    v-model="newProductOpen"
    title="新建文创资源"
    width="min(540px,92vw)"
    ><el-form label-position="top"
      ><el-form-item label="名称" required
        ><el-input v-model="productForm.title" maxlength="60" /></el-form-item
      ><el-form-item label="类别"
        ><el-select v-model="productForm.type"
          ><el-option label="公益文创" value="公益文创" /><el-option
            label="定制文创"
            value="定制文创" /></el-select></el-form-item
      ><el-form-item label="地区"
        ><el-select v-model="productForm.region"
          ><el-option
            v-for="r in regions"
            :key="r"
            :label="r"
            :value="r" /></el-select></el-form-item
      ><el-form-item label="介绍" required
        ><el-input
          v-model="productForm.description"
          type="textarea"
          maxlength="500" /></el-form-item
      ><el-form-item label="库存"
        ><el-input-number
          v-model="productForm.stock"
          :min="0"
          :precision="0" /></el-form-item
      ><el-form-item label="单次申领额度"
        ><el-input-number
          v-model="productForm.quota"
          :min="1"
          :precision="0" /></el-form-item></el-form
    ><template #footer
      ><el-button @click="newProductOpen = false">取消</el-button
      ><el-button
        v-has-permi="'welfare:write'"
        type="primary"
        @click="createProduct"
        >保存文创资源</el-button
      ></template
    ></el-dialog
  >
</template>
<style scoped>
.welfare-banner {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  background: #f0e9dd;
  border: 1px solid #e7ddcc;
  border-radius: 12px;
  padding: 28px 34px;
  margin-bottom: 22px;
  overflow: hidden;
}
.mini-label {
  font-size: 11px;
  letter-spacing: 3px;
  color: #947b56;
}
.welfare-banner h2 {
  font-family: serif;
  font-size: 26px;
  letter-spacing: 2px;
  color: #52462e;
  margin: 12px 0;
}
.welfare-banner p {
  font-size: 13px;
  color: #968368;
  line-height: 1.8;
  margin: 0;
}
.banner-seal {
  border: 2px solid #ac5347;
  padding: 8px 13px;
  color: #ac5347;
  flex-shrink: 0;
  font-family: serif;
  font-size: 27px;
  line-height: 1.25;
  transform: rotate(4deg);
  margin-right: 30px;
}
.welfare-stats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.welfare-stats .stat-card {
  display: flex;
  gap: 10px;
  align-items: center;
}
.welfare-stats .el-icon {
  font-size: 22px;
  color: #b29463;
}
.welfare-stats span {
  color: #7b7d77;
  font-size: 13px;
}
.welfare-stats strong {
  margin-left: auto;
  font-size: 28px;
}
.welfare-stats small {
  font-size: 12px;
  color: #92958d;
  font-weight: 400;
  margin-left: 7px;
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}
.product-card {
  border: 1px solid #e9e5dc;
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
  background: #fff;
}
.product-art {
  height: 178px;
  background: color-mix(in srgb, var(--product-color) 10%, #faf8f2);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
  color: var(--product-color);
}
.art-border {
  position: absolute;
  inset: 20px;
  border: 1px solid color-mix(in srgb, var(--product-color) 24%, transparent);
}
.art-character {
  font-family: serif;
  font-size: 74px;
  font-weight: 500;
  line-height: 1;
}
.art-wordmark {
  writing-mode: vertical-rl;
  font-size: 11px;
  letter-spacing: 3px;
}
.product-art .el-tag {
  position: absolute;
  top: 12px;
  right: 12px;
}
.product-body {
  padding: 19px 18px;
}
.product-category {
  font-size: 11px;
  color: #aa936c;
  letter-spacing: 1px;
}
.product-body h3 {
  font-size: 16px;
  margin: 9px 0;
  color: #383c35;
}
.product-body p {
  font-size: 12px;
  color: #99998f;
  line-height: 1.6;
  min-height: 38px;
  margin: 0;
}
.product-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  border-top: 1px solid #efeee8;
  padding-top: 16px;
  margin-top: 15px;
}
.product-metrics small {
  font-size: 11px;
  color: #94978e;
}
.product-metrics b {
  display: block;
  font-size: 22px;
  font-weight: 500;
  margin-top: 6px;
  color: #4c5348;
}
.product-metrics em {
  font-size: 11px;
  font-style: normal;
  color: #94978e;
  margin-left: 5px;
  font-weight: 400;
}
.product-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-top: 20px;
}
.product-actions .el-button {
  padding-left: 12px;
  padding-right: 12px;
}
.claim-id {
  display: block;
  font-size: 11px;
  margin-top: 5px;
}
.institution {
  font-weight: 500;
}
.claim-title {
  font-size: 22px;
  margin: 22px 0;
}
.drawer-subtitle {
  font-size: 14px;
  margin: 24px 0 12px;
}
.drawer-copy {
  font-size: 14px;
  line-height: 1.8;
  color: #777e70;
  background: #f7f8f4;
  padding: 16px;
  border-radius: 6px;
}
.drawer-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
}
.delivery-note {
  margin: 24px 0;
}
.filter-bar .el-input {
  max-width: 320px;
}
.filter-bar .el-select {
  width: 170px;
}
@media (max-width: 1300px) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 650px) {
  .welfare-banner {
    padding: 23px;
  }
  .welfare-banner h2 {
    font-size: 22px;
    line-height: 1.5;
  }
  .banner-seal {
    display: none;
  }
  .welfare-stats {
    grid-template-columns: 1fr;
  }
  .welfare-stats .stat-card {
    padding: 18px;
  }
  .product-grid {
    grid-template-columns: 1fr;
  }
  .product-art {
    height: 160px;
  }
  .product-body p {
    min-height: 0;
  }
  .filter-bar .el-input,
  .filter-bar .el-select {
    width: 100%;
    max-width: none;
  }
}
</style>
