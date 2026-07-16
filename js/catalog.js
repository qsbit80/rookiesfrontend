/* =========================================================
   캐치캐치 카테고리/브랜드 모듈 (js/catalog.js)
   ---------------------------------------------------------
   ⚠️ auth.js → api.js 다음에 로드할 것.

   역할:
   - 헤더 nav 의 슬러그(?cat=outer)와 백엔드 categoryId 를 잇는다.
     (nav/헤더 링크를 한 줄도 안 고치기 위한 계약)
   - /categories, /brands 조회 + 세션 캐시
   - 한글 초성 추출 (브랜드 초성 필터용, API 없이 계산)

   ⚠️ SLUG_TO_NAME 의 값(한글 이름)은 seed_catalog.sql 의 카테고리 이름과
      글자 단위로 일치해야 한다. 시드에서 이름을 바꾸면 여기도 바꿔야 한다.
   ========================================================= */
(function (global) {
  "use strict";

  // 헤더 nav 의 ?cat=슬러그 → 카테고리 한글 이름
  const SLUG_TO_NAME = {
    outer: "아우터",
    top: "상의",
    shirts: "셔츠",
    knit: "니트",
    pants: "팬츠",
    denim: "데님",
    shoes: "신발",
    bag: "가방",
    acc: "액세서리",
  };

  const CACHE_CATEGORIES = "catchcatch.cache.categories";

  // 재귀 트리 → 평탄한 [{categoryId, name}] 배열
  function flatten(nodes, out) {
    (nodes || []).forEach((node) => {
      out.push({ categoryId: node.categoryId, name: node.name });
      if (Array.isArray(node.children) && node.children.length) {
        flatten(node.children, out);
      }
    });
    return out;
  }

  const CatchCatalog = {
    SLUG_TO_NAME,

    // 카테고리 평탄 목록 (세션 캐시). 실패 시 빈 배열.
    async categories() {
      const cached = sessionStorage.getItem(CACHE_CATEGORIES);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (_) {
          /* 캐시 손상 시 재조회 */
        }
      }
      try {
        const tree = await CatchApi.get("/categories");
        const flat = flatten(tree, []);
        sessionStorage.setItem(CACHE_CATEGORIES, JSON.stringify(flat));
        return flat;
      } catch (_) {
        return [];
      }
    },

    // 슬러그(outer) → categoryId. 매칭 실패 시 null.
    async idBySlug(slug) {
      if (!slug) return null;
      const name = SLUG_TO_NAME[slug];
      if (!name) return null;
      const flat = await this.categories();
      const found = flat.find((c) => c.name === name);
      return found ? found.categoryId : null;
    },

    // categoryId → 슬러그 (목록 페이지에서 현재 카테고리 표시용). 실패 시 null.
    async slugById(categoryId) {
      if (categoryId == null) return null;
      const flat = await this.categories();
      const found = flat.find((c) => String(c.categoryId) === String(categoryId));
      if (!found) return null;
      const entry = Object.keys(SLUG_TO_NAME).find((slug) => SLUG_TO_NAME[slug] === found.name);
      return entry || null;
    },

    // 브랜드 목록 [{id, name, logoUrl}]. 실패 시 빈 배열.
    async brands() {
      try {
        return (await CatchApi.get("/brands")) || [];
      } catch (_) {
        return [];
      }
    },

    // 한글/영문 첫 글자의 초성 추출. 한글이 아니면 대문자 그대로, 그 외 '#'.
    initial(name) {
      if (!name) return "#";
      const CHO = [
        "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
        "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
      ];
      const ch = name.trim().charAt(0);
      const code = ch.charCodeAt(0);
      // 한글 음절 영역 (가 ~ 힣)
      if (code >= 0xac00 && code <= 0xd7a3) {
        return CHO[Math.floor((code - 0xac00) / 588)];
      }
      // 영문
      if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
      return "#";
    },
  };

  global.CatchCatalog = CatchCatalog;
})(window);
