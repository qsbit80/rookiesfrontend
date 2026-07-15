/* 관리자 - 상품 목록/삭제 (GET /admin/products, DELETE /admin/products/{id})
   ※ 백엔드 ProductListResponse에는 판매자/신고수/노출상태가 없어 해당 칸은 '-'로 표시하고,
     노출중지/복구 액션은 백엔드 API가 없어 제외(상세는 안내, 삭제만 실제 동작). */
(function () {
  "use strict";

  const rowsEl = document.getElementById("rows");
  const countEl = document.getElementById("count");
  const qEl = document.getElementById("q");
  const statusEl = document.getElementById("statusFilter");

  let PRODUCTS = [];

  function mapRow(p) {
    return {
      id: p.productId,
      name: p.name,
      price: p.finalPrice ?? p.price,
      basePrice: p.price,
      discountRate: p.discountRate ?? 0,
      finalPrice: p.finalPrice ?? p.price,
      thumbnailUrl: p.thumbnailUrl,
    };
  }

  function render(list, total = list.length) {
    if (!list.length) {
      rowsEl.innerHTML = '<tr class="empty-row"><td colspan="9">조건에 맞는 상품이 없습니다.</td></tr>';
      countEl.textContent = 0;
      return;
    }
    rowsEl.innerHTML = list.map((p) => `
      <tr data-id="${AdminUI.escape(p.id)}">
        <td class="chk"><input type="checkbox" aria-label="${AdminUI.escape(p.name)} 선택"></td>
        <td class="num">${AdminUI.escape(p.id)}</td>
        <td class="strong">${AdminUI.escape(p.name)}</td>
        <td class="muted">-</td>
        <td class="num">${AdminUI.won(p.price)}</td>
        <td><span class="tag ok">판매중</span></td>
        <td class="num muted">-</td>
        <td class="muted">-</td>
        <td>
          <div class="row-actions">
            <button class="btn sm" data-act="detail">상세</button>
            <button class="btn sm danger" data-act="delete">삭제</button>
          </div>
        </td>
      </tr>`).join("");
    countEl.textContent = total;
  }

  const listController = AdminUI.createListController({ pager: document.querySelector(".pager"), render });

  function applyFilter() {
    const q = qEl.value.trim().toLowerCase();
    listController.setItems(PRODUCTS.filter((p) =>
      !q || p.name.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q)
    ));
  }
  qEl.addEventListener("input", applyFilter);
  if (statusEl) statusEl.addEventListener("change", applyFilter);

  const checkAll = document.getElementById("checkAll");
  if (checkAll) checkAll.addEventListener("change", (e) => {
    rowsEl.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = e.target.checked));
  });

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.closest("tr").dataset.id;
    const p = PRODUCTS.find((x) => String(x.id) === String(id));
    if (!p) return;
    const act = btn.dataset.act;

    if (act === "detail") {
      AdminUI.detail("상품 상세", [
        ["상품 ID", p.id],
        ["상품명", p.name],
        ["정상가", AdminUI.won(p.basePrice)],
        ["할인율", `${p.discountRate}%`],
        ["판매가", AdminUI.won(p.finalPrice)],
        ["썸네일", p.thumbnailUrl || "(없음)"],
      ]);
      return;
    }

    if (act === "delete") {
      const ok = await AdminUI.confirm({
        title: "상품 강제 삭제",
        message: `[${p.name}]을(를) 영구 삭제합니다. 되돌릴 수 없습니다. 진행하시겠습니까?`,
        okText: "삭제", danger: true,
      });
      if (!ok) return;
      try {
        await AdminApi.del(`/products/${p.id}`);
        PRODUCTS = PRODUCTS.filter((x) => String(x.id) !== String(id));
        applyFilter();
        AdminUI.toast("상품이 삭제되었습니다.");
      } catch (err) {
        AdminUI.toast(err.message || "삭제에 실패했습니다.");
      }
    }
  });

  async function load() {
    try {
      const data = await AdminApi.list("/products?size=200");
      PRODUCTS = data.map(mapRow);
      applyFilter();
    } catch (err) {
      rowsEl.innerHTML = `<tr class="empty-row"><td colspan="9">${AdminUI.escape(err.message || "목록을 불러오지 못했습니다.")}</td></tr>`;
      countEl.textContent = 0;
    }
  }

  load();
})();
