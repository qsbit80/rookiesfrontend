/* 관리자 - 플랫폼 정산 (GET /admin/settlements)
   ※ 백엔드는 플랫폼 '합계'만 제공(거래액/수수료/지급액). 판매자별 명세 API는 없어
     상단 요약 카드만 실데이터로 채우고, 아래 표에는 안내를 표시한다. */
(function () {
  "use strict";

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showTableNote(message) {
    if (rowsEl) rowsEl.innerHTML = `<tr class="empty-row"><td colspan="7">${AdminUI.escape(message)}</td></tr>`;
    if (countEl) countEl.textContent = 0;
  }

  async function load() {
    try {
      const data = await AdminApi.get("/settlements");
      const sales = Number(data.totalSalesAmount || 0);
      const fee = Number(data.totalCommissionAmount || 0);
      const payout = Number(data.totalPayoutAmount || 0);

      setText("stTotal", AdminUI.won(sales));
      setText("stFee", AdminUI.won(fee));
      setText("stPending", AdminUI.won(payout)); // 판매자 지급 예정 총액
      setText("stDone", AdminUI.won(0));

      showTableNote("플랫폼 전체 합계는 상단 카드에 표시됩니다. 판매자별 정산 명세 API는 준비 중입니다.");
    } catch (err) {
      showTableNote(err.message || "정산 데이터를 불러오지 못했습니다.");
    }
  }

  load();
})();
