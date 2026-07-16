/* ============================================================
 * 위시리스트(wishlist) — 실제 백엔드 연동 버전
 * ------------------------------------------------------------
 * 기존 파일은 상품이 하드코딩되어 있어서 DB(찜)와 무관하게 떴습니다.
 * 이 파일은 실제 API를 호출해서 내 찜 목록을 그립니다.
 *
 *  - 목록 조회 : GET  /api/v1/users/me/wishlist        (PageResponse<WishlistItemResponse>)
 *  - 찜 해제   : POST /api/v1/products/{productId}/like  (토글: 이미 찜한 상태면 해제됨)
 *  - 담기 옵션 : GET  /api/v1/products/{productId}       (options[]에서 재고 있는 옵션 선택)
 *  - 장바구니  : POST /api/v1/carts                      body: { productId, productOptionId, quantity }
 *
 * ※ API_BASE / getAccessToken() 은 orders.html(리더 완성본)과 동일 규칙.
 * ============================================================ */
(function () {
  'use strict';

  const API_BASE = 'http://localhost:8080/api/v1';

  function getAccessToken() {
    return localStorage.getItem('accessToken');
  }
  function authHeaders() {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
    });
    if (res.status === 401) {
      location.href = 'login.html';
      throw new Error('로그인이 필요합니다.');
    }
    let body = null;
    const text = await res.text();
    if (text) { try { body = JSON.parse(text); } catch (_) { body = null; } }
    if (!res.ok || (body && body.success === false)) {
      throw new Error((body && body.message) || '요청 처리 중 오류가 발생했습니다.');
    }
    return body ? body.data : null;
  }

  /* ---------- DOM refs ---------- */
  const grid = document.querySelector('[data-role="wish-grid"]');
  const body = document.querySelector('[data-role="wish-body"]');
  const empty = document.querySelector('[data-role="wish-empty"]');
  const totalEl = document.querySelector('[data-role="total"]');
  const total2El = document.querySelector('[data-role="total-count2"]');
  const checkedCountEl = document.querySelector('[data-role="checked-count"]');
  const checkAllEl = document.querySelector('[data-action="check-all"]');
  const addCartCheckedBtn = document.querySelector('[data-action="add-cart-checked"]');
  const deleteCheckedBtn = document.querySelector('[data-action="delete-checked"]');

  if (!grid) return;

  /* ---------- state ---------- */
  let items = []; // WishlistItemResponse[]
  const fmt = new Intl.NumberFormat('ko-KR');
  const won = (n) => `${fmt.format(n ?? 0)}원`;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let toastEl;
  function showMessage(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'wish-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ---------- render ---------- */
  function cardHtml(it) {
    const thumb = it.thumbnailUrl
      ? `<img src="${escapeHtml(it.thumbnailUrl)}" alt="${escapeHtml(it.name)}" loading="lazy">`
      : '<span class="wc-noimg" aria-hidden="true"></span>';

    const priceBlock = it.discountRate > 0
      ? `<span class="wc-rate">${it.discountRate}%</span>
         <span class="wc-origin">${won(it.price)}</span>
         <strong>${won(it.finalPrice)}</strong>`
      : `<strong>${won(it.finalPrice)}</strong>`;

    return `
      <div class="wc-card" data-product-id="${it.productId}">
        <div class="wc-media">
          <input type="checkbox" class="wc-check" data-role="item-check" aria-label="선택">
          <button type="button" class="wc-remove" data-action="remove" aria-label="찜 해제">×</button>
          <a class="wc-thumb" href="product-detail.html?id=${it.productId}">${thumb}</a>
        </div>
        <div class="wc-info">
          <a class="wc-name" href="product-detail.html?id=${it.productId}">${escapeHtml(it.name)}</a>
          <div class="wc-price">${priceBlock}</div>
          <button type="button" class="wc-cart" data-action="add-cart">장바구니 담기</button>
        </div>
      </div>`;
  }

  function render() {
    const total = items.length;
    if (totalEl) totalEl.textContent = total;
    if (total2El) total2El.textContent = total;

    if (total === 0) {
      if (body) body.hidden = true;
      if (empty) empty.hidden = false;
      updateCheckedCount();
      return;
    }
    if (body) body.hidden = false;
    if (empty) empty.hidden = true;
    grid.innerHTML = items.map(cardHtml).join('');
    if (checkAllEl) checkAllEl.checked = false;
    updateCheckedCount();
  }

  function getCheckedProductIds() {
    return [...grid.querySelectorAll('[data-role="item-check"]')]
      .filter((cb) => cb.checked)
      .map((cb) => Number(cb.closest('.wc-card').dataset.productId));
  }

  function updateCheckedCount() {
    const n = getCheckedProductIds().length;
    if (checkedCountEl) checkedCountEl.textContent = n;
    if (checkAllEl) {
      checkAllEl.checked = items.length > 0 && n === items.length;
    }
  }

  /* ---------- load ---------- */
  async function loadWishlist() {
    try {
      // size를 넉넉히 잡아 한 번에 전부 표시
      const data = await apiFetch('/users/me/wishlist?page=0&size=100');
      items = (data && data.content) || [];
      render();
    } catch (err) {
      grid.innerHTML = '';
      if (body) body.hidden = true;
      if (empty) { empty.hidden = false; }
      showMessage(err.message);
    }
  }

  /* ---------- 찜 해제 (POST like 토글) ---------- */
  async function removeLike(productId) {
    try {
      await apiFetch(`/products/${productId}/like`, { method: 'POST' });
      items = items.filter((it) => it.productId !== productId);
      render();
    } catch (err) {
      showMessage(err.message);
    }
  }

  async function removeCheckedLikes() {
    const ids = getCheckedProductIds();
    if (ids.length === 0) { showMessage('선택된 상품이 없습니다.'); return; }
    if (!confirm(`선택한 ${ids.length}개를 위시리스트에서 삭제할까요?`)) return;
    try {
      await Promise.all(ids.map((id) => apiFetch(`/products/${id}/like`, { method: 'POST' })));
      const set = new Set(ids);
      items = items.filter((it) => !set.has(it.productId));
      render();
    } catch (err) {
      showMessage(err.message);
      loadWishlist();
    }
  }

  /* ---------- 장바구니 담기 ---------- */
  // 상세 조회로 재고 있는 첫 옵션을 골라 담는다. 담을 옵션이 없으면 상세페이지로 이동.
  async function addToCart(productId) {
    const detail = await apiFetch(`/products/${productId}`);
    const opt = (detail.options || []).find((o) => !o.soldOut);
    if (!opt) {
      location.href = `product-detail.html?id=${productId}`;
      return false;
    }
    await apiFetch('/carts', {
      method: 'POST',
      body: JSON.stringify({ productId, productOptionId: opt.optionId, quantity: 1 }),
    });
    return true;
  }

  async function addOneToCart(productId) {
    try {
      const ok = await addToCart(productId);
      if (ok) showMessage('장바구니에 담았습니다.');
    } catch (err) {
      showMessage(err.message);
    }
  }

  async function addCheckedToCart() {
    const ids = getCheckedProductIds();
    if (ids.length === 0) { showMessage('선택된 상품이 없습니다.'); return; }
    let success = 0;
    for (const id of ids) {
      try { if (await addToCart(id)) success += 1; } catch (_) { /* 개별 실패는 건너뜀 */ }
    }
    showMessage(success > 0 ? `${success}개 상품을 장바구니에 담았습니다.` : '담기에 실패했습니다.');
  }

  /* ---------- 이벤트 ---------- */
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = e.target.closest('.wc-card');
    if (!card) return;
    const productId = Number(card.dataset.productId);
    if (btn.dataset.action === 'remove') removeLike(productId);
    if (btn.dataset.action === 'add-cart') addOneToCart(productId);
  });

  grid.addEventListener('change', (e) => {
    if (e.target.matches('[data-role="item-check"]')) updateCheckedCount();
  });

  if (checkAllEl) {
    checkAllEl.addEventListener('change', () => {
      const checked = checkAllEl.checked;
      grid.querySelectorAll('[data-role="item-check"]').forEach((cb) => (cb.checked = checked));
      updateCheckedCount();
    });
  }
  if (addCartCheckedBtn) addCartCheckedBtn.addEventListener('click', addCheckedToCart);
  if (deleteCheckedBtn) deleteCheckedBtn.addEventListener('click', removeCheckedLikes);

  /* ---------- init ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWishlist);
  } else {
    loadWishlist();
  }
})();
