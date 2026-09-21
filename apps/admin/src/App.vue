<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Bell,
  Search,
  ArrowDown,
  ArrowRight,
  Expand,
  QuestionFilled,
  TopRight,
  Refresh,
  Location,
} from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import SidebarNav from "./components/SidebarNav.vue";
import {
  activityLog,
  navigation,
  regions,
  workspace,
} from "./domain/workspace";

const route = useRoute();
const router = useRouter();
const current = computed(() =>
  navigation.find((item) => item.path === route.path),
);
const searchOpen = ref(false);
const search = ref("");
const helpOpen = ref(false);
const menuMatches = computed(() =>
  navigation.filter((item) =>
    item.title.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
);
const miniappUrl = `${window.location.protocol}//${window.location.hostname}:5173/`;
function navigate(path: string) {
  router.push(path);
  searchOpen.value = false;
  search.value = "";
}
async function reset() {
  try {
    await ElMessageBox.confirm(
      "所有页面将恢复初始示例，本次会话的修改会清除。",
      "重置演示",
      {
        confirmButtonText: "重置",
        cancelButtonText: "保留修改",
        type: "warning",
      },
    );
    window.location.reload();
  } catch {
    /* Cancel keeps current demo. */
  }
}
</script>
<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <router-link to="/overview" class="brand" aria-label="家风中华行运营首页"
        ><span class="brand-seal">家</span>
        <div>
          <strong>家风中华行</strong><small>文化共建 · 共享传承</small>
        </div></router-link
      >
      <div class="workspace-label">
        <span class="status-dot" /> 全国运营中心 <span>工作空间</span>
      </div>
      <SidebarNav />
      <div class="sidebar-footer">
        <el-button text @click="helpOpen = true"
          ><el-icon><QuestionFilled /></el-icon> 使用说明</el-button
        ><span>界面预览 v0.1</span>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          <el-button
            class="mobile-menu"
            text
            :icon="Expand"
            aria-label="展开导航"
            @click="workspace.sidebarOpen = true"
          /><span class="breadcrumb-root">运营管理平台</span
          ><el-icon class="breadcrumb-separator"><ArrowRight /></el-icon
          ><strong>{{ current?.title }}</strong>
        </div>
        <div class="topbar-actions">
          <el-button
            class="search-trigger"
            text
            :icon="Search"
            aria-label="搜索功能"
            @click="searchOpen = true"
            ><span>搜索功能</span></el-button
          >
          <div class="header-region">
            <el-icon><Location /></el-icon
            ><el-select
              v-model="workspace.region"
              aria-label="全局地区筛选"
              style="width: 108px"
              :teleported="true"
              ><el-option
                v-for="region in regions"
                :key="region"
                :value="region"
                :label="region"
            /></el-select>
          </div>
          <el-popover placement="bottom-end" :width="310" trigger="click">
            <template #reference
              ><el-button
                text
                :icon="Bell"
                aria-label="查看操作动态"
                class="notification-button"
                ><span class="unread-dot" /></el-button
            ></template>
            <div class="popover-heading">
              本次操作动态 <el-tag size="small" type="info">示例</el-tag>
            </div>
            <div
              v-for="item in activityLog.slice(0, 4)"
              :key="item.id"
              class="notification-item"
            >
              <b>{{ item.action }}</b
              ><span>{{ item.target }}</span
              ><small>{{ item.time }}</small>
            </div>
            <el-button text type="primary" @click="router.push('/settings')"
              >查看操作日志</el-button
            >
          </el-popover>
          <div class="topbar-divider" />
          <el-dropdown
            trigger="click"
            @command="
              (command: string) =>
                command === 'reset' ? reset() : (helpOpen = true)
            "
          >
            <button class="account-button" aria-label="演示管理员菜单">
              <span class="account-avatar">管</span
              ><span class="account-copy"
                ><b>运营管理员</b><small>演示身份</small></span
              ><el-icon><ArrowDown /></el-icon>
            </button>
            <template #dropdown
              ><el-dropdown-menu
                ><el-dropdown-item command="help"
                  >演示范围与说明</el-dropdown-item
                ><el-dropdown-item command="reset" :icon="Refresh" divided
                  >重置全部示例</el-dropdown-item
                ></el-dropdown-menu
              ></template
            >
          </el-dropdown>
        </div>
      </header>
      <div class="demo-ribbon">
        <span
          ><span class="ribbon-mark">预览</span>
          当前为界面演示，数据均为示例，修改仅在本次会话有效。</span
        ><a :href="miniappUrl" target="_blank" rel="noopener"
          >查看用户端 <el-icon><TopRight /></el-icon
        ></a>
      </div>
      <main class="page-content" id="main-content"><router-view /></main>
      <footer class="main-footer">
        <span>家风中华行 · 文化共建共享平台</span
        ><span>让优良家风，走进万千家庭</span>
      </footer>
    </div>
    <el-drawer
      v-model="workspace.sidebarOpen"
      direction="ltr"
      size="252px"
      :with-header="false"
      class="mobile-nav-drawer"
      ><div class="brand">
        <span class="brand-seal">家</span>
        <div><strong>家风中华行</strong><small>运营管理平台</small></div>
      </div>
      <SidebarNav
    /></el-drawer>
    <el-dialog
      v-model="searchOpen"
      title="快速进入功能"
      width="min(540px, 92vw)"
      ><el-input
        v-model="search"
        :prefix-icon="Search"
        placeholder="输入功能名称，例如“评审”"
        clearable
        autofocus />
      <div class="menu-search-results">
        <el-button
          v-for="item in menuMatches"
          :key="item.path"
          text
          @click="navigate(item.path)"
          ><span>{{ item.title }}</span
          ><el-icon><ArrowRight /></el-icon></el-button
        ><el-empty
          v-if="!menuMatches.length"
          description="没有匹配的功能，试试其他关键词"
          :image-size="70"
        /></div
    ></el-dialog>
    <el-drawer
      v-model="helpOpen"
      title="关于这个工作空间"
      size="min(480px, 100vw)"
    >
      <div class="help-seal">家</div>
      <h2 class="serif">以家风，涵养时代新风</h2>
      <p class="help-intro">
        这里是家风中华行运营后台的界面演示，可用于讨论工作流程、页面结构与操作方式。
      </p>
      <el-divider />
      <h3>可以体验</h3>
      <p>
        稿件筛选与初审、专家分配与打分、资讯编辑与上下架、分卷编排、活动管理、用户及运营配置等示例操作。
      </p>
      <h3>数据如何保留</h3>
      <p>
        所有业务记录只存在于当前页面会话。刷新页面或选择“重置全部示例”后恢复初始数据；不读取或修改5173用户端的数据。
      </p>
      <h3>尚未连接的能力</h3>
      <p>
        真实登录权限、文件上传、消息发送、数据库、AI推理、电子签章及工作流服务均未接入。六级评审仅供流程讨论。
      </p>
      <el-button type="primary" @click="helpOpen = false">开始体验</el-button>
    </el-drawer>
  </div>
</template>
