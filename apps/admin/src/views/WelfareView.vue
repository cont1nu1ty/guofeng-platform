<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Search, Box, Present, Van } from "@element-plus/icons-vue";
import PageHeading from "../components/PageHeading.vue";
import {
  products,
  welfareClaims,
  productTitle,
  toggleProduct,
  saveProduct,
  processClaim,
  type Product,
  type WelfareClaim,
} from "../domain/operations";
import { matchesRegion } from "../domain/workspace";
const tab = ref("products"),
  query = ref(""),
  category = ref(""),
  claimStatus = ref("");
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
function saveStock() {
  if (!currentProduct.value) return;
  const result = saveProduct(
    currentProduct.value.id,
    stockForm.stock,
    stockForm.quota,
  );
  if (!result.ok) return ElMessage.warning(result.message);
  ElMessage.success(result.message);
  stockOpen.value = false;
}
function changeProduct(item: Product) {
  toggleProduct(item.id);
  ElMessage.success(`“${item.title}”示例状态已更新`);
}
const claimOpen = ref(false),
  currentClaim = ref<WelfareClaim | null>(null),
  returnNote = ref("");
function openClaim(item: WelfareClaim) {
  currentClaim.value = item;
  returnNote.value = "";
  claimOpen.value = true;
}
function act(action: "approve" | "return" | "deliver") {
  if (!currentClaim.value) return;
  const result = processClaim(currentClaim.value.id, action, returnNote.value);
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
  />
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
      <el-icon><Present /></el-icon><span>示例文创品类</span
      ><strong>{{ products.length }}<small>款</small></strong>
    </div>
    <div class="stat-card">
      <el-icon><Box /></el-icon><span>待审核申领</span
      ><strong
        >{{ regionalClaims.filter((i) => i.status === "待审核").length
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
        label="公益申领与发放"
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
                <small>示例库存</small><b>{{ item.stock }}<em>件</em></b>
              </div>
              <div>
                <small>单次申领额度</small><b>{{ item.quota }}<em>件</em></b>
              </div>
            </div>
            <div class="product-actions">
              <el-button @click="editStock(item)">库存与额度</el-button
              ><el-button link type="primary" @click="changeProduct(item)">{{
                item.status === "上架中" ? "下架" : "上架"
              }}</el-button>
            </div>
          </div>
        </article>
      </div>
      <el-empty
        v-if="!visibleProducts.length"
        description="没有找到文创资源，请调整筛选"
      />
      <p class="empty-note">
        商品与库存均为预置样例。定制文创暂展示资源，不涉及报价、支付和实际订单。
      </p></template
    >
    <template v-else
      ><el-table :data="visibleClaims" row-key="id"
        ><el-table-column label="申领机构" min-width="210"
          ><template #default="{ row }"
            ><b class="institution">{{ row.organization }}</b
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
              >{{ row.status }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column label="操作" width="110" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openClaim(row)">{{
              row.status === "待审核"
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
        共 {{ visibleClaims.length }} 笔示例申领 ·
        模拟发放会同步扣减本次会话库存，不产生实际配送。
      </div></template
    >
  </section>
  <el-dialog v-model="stockOpen" title="库存与公益额度" width="min(520px, 92vw)"
    ><p v-if="currentProduct" class="muted">{{ currentProduct.title }}</p>
    <el-form label-position="top"
      ><el-form-item label="示例库存（件）"
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
      title="这里只调整本次会话中的示例数值。"
      type="info"
      :closable="false"
    /><template #footer
      ><el-button @click="stockOpen = false">取消</el-button
      ><el-button type="primary" @click="saveStock"
        >保存调整</el-button
      ></template
    ></el-dialog
  >
  <el-drawer v-model="claimOpen" title="公益申领详情" size="min(620px, 100vw)"
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
          currentClaim.status
        }}</el-descriptions-item></el-descriptions
      >
      <h3 class="drawer-subtitle">申领用途</h3>
      <p class="drawer-copy">{{ currentClaim.purpose }}</p>
      <template v-if="currentClaim.note"
        ><h3 class="drawer-subtitle">处理备注</h3>
        <p class="drawer-copy">{{ currentClaim.note }}</p></template
      ><template v-if="currentClaim.status === '待审核'"
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
          <el-button @click="act('return')">退回补充</el-button
          ><el-button type="primary" @click="act('approve')"
            >模拟通过审核</el-button
          >
        </div></template
      ><template v-else-if="currentClaim.status === '待发放'"
        ><el-alert
          class="delivery-note"
          title="处理后扣减示例库存并更新台账，无实际物流。"
          type="info"
          :closable="false"
        /><el-button type="primary" @click="act('deliver')"
          >完成示例发放</el-button
        ></template
      ></template
    ></el-drawer
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
