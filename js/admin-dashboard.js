/* 관리자 - 운영 대시보드 요약 (GET /admin/dashboard) */
(function () {
  "use strict";

  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function load() {
    try {
      const d = await AdminApi.get("/dashboard");
      set("mUsers", AdminUI.num(d.totalUsers));
      set("mProducts", AdminUI.num(d.totalProducts));
      set("mRequests", AdminUI.num((d.pendingApplications || 0) + (d.pendingCouponRequests || 0)));
      set("mQna", AdminUI.num(d.unansweredQna));
    } catch (err) {
      // 실패 시 카드는 — 로 유지
      console.warn("대시보드 요약 로드 실패:", err.message);
    }
  }

  load();
})();
