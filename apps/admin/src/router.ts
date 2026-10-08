import { createRouter, createWebHashHistory } from "vue-router";

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/", redirect: "/overview" },
    { path: "/overview", component: () => import("./views/OverviewView.vue") },
    {
      path: "/submissions",
      component: () => import("./views/SubmissionsView.vue"),
    },
    { path: "/reviews", component: () => import("./views/ReviewsView.vue") },
    { path: "/experts", component: () => import("./views/ExpertsView.vue") },
    { path: "/content", component: () => import("./views/ContentView.vue") },
    {
      path: "/collections",
      component: () => import("./views/CollectionsView.vue"),
    },
    {
      path: "/activities",
      component: () => import("./views/ActivitiesView.vue"),
    },
    {
      path: "/education",
      component: () => import("./views/EducationView.vue"),
    },
    { path: "/welfare", component: () => import("./views/WelfareView.vue") },
    { path: "/users", component: () => import("./views/UsersView.vue") },
    { path: "/certificates", component: () => import("./views/CertificatesView.vue") },
    { path: "/resources", component: () => import("./views/ResourcesView.vue") },
    { path: "/jobs", component: () => import("./views/JobsView.vue") },
    { path: "/ai", component: () => import("./views/AiView.vue") },
    {
      path: "/analytics",
      component: () => import("./views/AnalyticsView.vue"),
    },
    { path: "/settings", component: () => import("./views/SettingsView.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/overview" },
  ],
});
