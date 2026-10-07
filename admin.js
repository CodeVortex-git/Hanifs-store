(() => {
  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const defaultApiBase = isLocalHost ? `http://${window.location.hostname}:5000` : "";
  const apiBase = String(window.HANIFS_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");
  const authUrl = `${apiBase}/api/admin/auth`;
  const dashboardUrl = `${apiBase}/api/admin/dashboard`;
  const productsUrl = `${apiBase}/api/admin/products`;
  const inventoryUrl = `${apiBase}/api/admin/inventory`;
  const elements = {
    loading: document.querySelector("#admin-loading"),
    signedOut: document.querySelector("#admin-signed-out"),
    signInMessage: document.querySelector("#sign-in-message"),
    loginForm: document.querySelector("#admin-login-form"),
    loginButton: document.querySelector("#admin-login-form button[type='submit']"),
    error: document.querySelector("#admin-error"),
    errorMessage: document.querySelector("#admin-error-message"),
    retry: document.querySelector("#admin-retry"),
    dashboard: document.querySelector("#dashboard-content"),
    products: document.querySelector("#products-content"),
    inventory: document.querySelector("#inventory-content"),
    nav: document.querySelector("#admin-nav"),
    identity: document.querySelector("#admin-identity"),
    logout: document.querySelector("#admin-logout"),
    logoutMessage: document.querySelector("#logout-message"),
  };
  let csrfToken = null;
  let authenticatedAdmin = null;
  let productPage = 1;
  let productLimit = 10;
  let productQuery = "";
  let productActiveFilter = "all";
  let productEditing = null;
  let variantEditing = null;
  let productFeedback = "";
  let productFeedbackKind = "";
  let inventoryPage = 1;
  const inventoryLimit = 20;
  let inventoryQuery = "";
  let inventoryStatus = "all";
  let inventoryLowStock = false;
  let inventorySelected = null;
  let inventoryFeedback = "";
  let inventoryFeedbackKind = "";

  function showOnly(target) {
    for (const panel of [elements.loading, elements.signedOut, elements.error, elements.dashboard, elements.products, elements.inventory]) {
      panel.hidden = panel !== target;
    }
    elements.nav.hidden = ![elements.dashboard, elements.products, elements.inventory].includes(target);
  }

  function showSignedOut(message = "Sign in with an administrator account to view store metrics.") {
    csrfToken = null;
    authenticatedAdmin = null;
    elements.identity.hidden = true;
    elements.logout.hidden = true;
    elements.nav.hidden = true;
    elements.signInMessage.textContent = message;
    elements.loginForm.reset();
    showOnly(elements.signedOut);
  }

  function showError(message) {
    elements.errorMessage.textContent = message;
    showOnly(elements.error);
  }

  async function apiRequest(url, options = {}) {
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: { Accept: "application/json", ...(options.headers || {}) },
    });
  }

  function validDashboard(data) {
    const values = [
      data?.orders?.total, data?.orders?.pending, data?.orders?.paid,
      data?.revenue?.successfulKobo, data?.customers?.total,
      data?.products?.active, data?.inventory?.lowStockVariants,
      data?.inventory?.threshold,
    ];
    return data?.currency === "NGN" && values.every((value) => Number.isSafeInteger(value) && value >= 0);
  }

  function formatNairaFromKobo(kobo) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency", currency: "NGN", maximumFractionDigits: 0,
    }).format(kobo / 100);
  }

  function formatKoboInput(kobo) {
    return `${Math.floor(kobo / 100)}.${String(kobo % 100).padStart(2, "0")}`;
  }

  function parseNairaInput(value) {
    const normalized = String(value).trim();
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
    if (!match) throw new Error("Enter a Naira amount with no more than two decimal places.");
    const whole = Number(match[1]);
    const fractional = Number((match[2] || "").padEnd(2, "0"));
    const kobo = whole * 100 + fractional;
    if (!Number.isSafeInteger(kobo) || kobo < 1 || kobo > 2_147_483_647) {
      throw new Error("Price must be positive and within the supported range.");
    }
    return kobo;
  }

  function escapeAdminHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function adminHeaders(method, headers = {}) {
    const result = { ...headers };
    if (method && method !== "GET" && csrfToken) result["X-CSRF-Token"] = csrfToken;
    return result;
  }

  function updateAdminViewButtons(view) {
    elements.nav.querySelectorAll("[data-admin-view]").forEach((button) => {
      const active = button.dataset.adminView === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function showProductFeedback(message, kind = "info") {
    productFeedback = message;
    productFeedbackKind = kind;
    const status = document.querySelector("#products-feedback");
    if (status) {
      status.textContent = message;
      status.className = `products-feedback products-feedback--${kind}`;
    }
  }

  function productPriceSummary(price) {
    return escapeAdminHtml(formatNairaFromKobo(price));
  }

  function renderProductManagement(payload) {
    const products = payload.products;
    const pagination = payload.pagination;
    const rows = products.map((product) => `
      <article class="product-admin-row">
        <div class="product-admin-row__main">
          <strong>${escapeAdminHtml(product.name)}</strong>
          <span>${escapeAdminHtml(product.category)} · ${escapeAdminHtml(product.gender)}</span>
        </div>
        <div class="product-admin-row__meta">
          <span>${productPriceSummary(product.basePrice)}</span>
          <span class="status-pill ${product.active ? "status-pill--active" : "status-pill--inactive"}">${product.active ? "Active" : "Inactive"}</span>
          <span>${product.featured ? "Featured" : ""}${product.featured && product.newArrival ? " · " : ""}${product.newArrival ? "New" : ""}</span>
          <span>${product.variants.length} variants</span>
        </div>
        <button class="button button--secondary" type="button" data-product-edit="${escapeAdminHtml(product.id)}">Edit</button>
      </article>`).join("");
    const pageCount = Math.max(1, pagination.totalPages);
    const editor = productEditing ? renderProductEditor(productEditing) : "";
    elements.products.innerHTML = `
      <div class="products-heading"><div><p class="eyebrow">CATALOG</p><h2>Product management</h2><p>Update catalog details and variants. Stock is read-only here.</p></div><button class="button button--primary" type="button" data-product-create>New product</button></div>
      <form id="products-search-form" class="products-toolbar">
        <label>Search products<input name="q" type="search" maxlength="100" value="${escapeAdminHtml(productQuery)}" placeholder="Name, category, gender"></label>
        <label>Status<select name="active"><option value="all" ${productActiveFilter === "all" ? "selected" : ""}>All products</option><option value="true" ${productActiveFilter === "true" ? "selected" : ""}>Active</option><option value="false" ${productActiveFilter === "false" ? "selected" : ""}>Inactive</option></select></label>
        <button class="button button--secondary" type="submit">Search</button>
      </form>
      <p id="products-feedback" class="products-feedback ${productFeedbackKind ? `products-feedback--${productFeedbackKind}` : ""}" role="status" aria-live="polite">${escapeAdminHtml(productFeedback)}</p>
      <div class="product-admin-list">${rows || '<p class="products-empty">No products match these filters.</p>'}</div>
      <div class="products-pagination"><span>${pagination.total} product${pagination.total === 1 ? "" : "s"} · Page ${pagination.page} of ${pageCount}</span><div><button class="button button--secondary" type="button" data-product-page="${pagination.page - 1}" ${pagination.page <= 1 ? "disabled" : ""}>Previous</button><button class="button button--secondary" type="button" data-product-page="${pagination.page + 1}" ${pagination.page >= pageCount ? "disabled" : ""}>Next</button></div></div>
      ${editor}`;
    updateAdminViewButtons("products");
  }

  function formatInventoryDate(value) {
    if (!value) return "Not scheduled";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function renderInventory(payload) {
    const pageCount = Math.max(1, payload.pagination.totalPages);
    const rows = payload.inventory.map((item) => `
      <article class="inventory-row">
        <div class="inventory-row__product"><strong>${escapeAdminHtml(item.productName)}</strong><span>Product #${item.productId} · Variant #${item.id}</span><span>${escapeAdminHtml(item.category)}</span></div>
        <div class="inventory-row__variant"><strong>${escapeAdminHtml(item.size)} · ${escapeAdminHtml(item.color)}</strong><span class="status-pill ${item.productActive && item.variantActive ? "status-pill--active" : "status-pill--inactive"}">${item.productActive && item.variantActive ? (item.availableStock === 0 ? "Out of stock" : "Active") : "Inactive"}</span></div>
        <div class="inventory-row__numbers"><span>Stock <strong>${item.stock}</strong></span><span>Available <strong>${item.availableStock}</strong></span><span>Reserved <strong>${item.reservedStock}</strong></span>${item.expiredReservationStock ? `<span class="inventory-warning">Expired hold pending release: ${item.expiredReservationStock}</span>` : ""}${item.isLowStock ? `<span class="inventory-warning">Low stock (≤ ${payload.lowStockThreshold})</span>` : ""}${item.reconciliationRequired ? `<span class="inventory-warning">Payment reconciliation required (${item.reconciliationCount})</span>` : ""}</div>
        <button class="button button--secondary" type="button" data-inventory-open="${item.id}">History / adjust</button>
      </article>`).join("");
    const detail = inventorySelected ? renderInventoryDetail(inventorySelected) : "";
    elements.inventory.innerHTML = `
      <div class="products-heading"><div><p class="eyebrow">STOCK CONTROL</p><h2>Inventory</h2><p>Available stock excludes units currently held for payment. Reservations are shown separately.</p></div></div>
      <form id="inventory-search-form" class="products-toolbar inventory-toolbar">
        <label>Search<input name="q" type="search" maxlength="100" value="${escapeAdminHtml(inventoryQuery)}" placeholder="Product, category, size, color"></label>
        <label>Availability<select name="status"><option value="all" ${inventoryStatus === "all" ? "selected" : ""}>All variants</option><option value="active" ${inventoryStatus === "active" ? "selected" : ""}>Active for sale</option><option value="inactive" ${inventoryStatus === "inactive" ? "selected" : ""}>Inactive</option></select></label>
        <label class="inventory-checkbox"><input name="lowStock" type="checkbox" ${inventoryLowStock ? "checked" : ""}> Low stock only</label>
        <button class="button button--secondary" type="submit">Filter</button>
      </form>
      <p class="products-feedback ${inventoryFeedbackKind ? `products-feedback--${inventoryFeedbackKind}` : ""}" role="status" aria-live="polite">${escapeAdminHtml(inventoryFeedback)}</p>
      <div class="inventory-list">${rows || '<p class="products-empty">No inventory matches these filters.</p>'}</div>
      <div class="products-pagination"><span>${payload.pagination.total} variants · Page ${payload.pagination.page} of ${pageCount} · Low stock at or below ${payload.lowStockThreshold}</span><div><button class="button button--secondary" type="button" data-inventory-page="${payload.pagination.page - 1}" ${payload.pagination.page <= 1 ? "disabled" : ""}>Previous</button><button class="button button--secondary" type="button" data-inventory-page="${payload.pagination.page + 1}" ${payload.pagination.page >= pageCount ? "disabled" : ""}>Next</button></div></div>
      ${detail}`;
    updateAdminViewButtons("inventory");
  }

  function renderInventoryDetail(detail) {
    const item = detail.inventory;
    const history = detail.adjustments.map((entry) => `<article class="inventory-history-row"><span>${formatInventoryDate(entry.createdAt)}</span><span>${entry.delta > 0 ? "+" : ""}${entry.delta} · ${entry.previousStock} → ${entry.resultingStock}</span><span>${escapeAdminHtml(entry.reason)}</span><span>${escapeAdminHtml(entry.admin.displayName)}</span></article>`).join("");
    const minDelta = -item.stock;
    const maxDelta = 2_147_483_647 - item.stock;
    return `<section class="inventory-detail" aria-labelledby="inventory-detail-title"><div class="product-editor__heading"><div><p class="eyebrow">VARIANT #${item.id}</p><h3 id="inventory-detail-title">${escapeAdminHtml(item.productName)} · ${escapeAdminHtml(item.size)} / ${escapeAdminHtml(item.color)}</h3></div><button class="button button--secondary" type="button" data-inventory-close>Close</button></div>
      <p>Available stock: <strong>${item.availableStock}</strong> · Reserved: <strong>${item.reservedStock}</strong> · Active holds: ${item.activeReservedStock} · Expired holds pending release: ${item.expiredReservationStock}</p>
      ${item.nextReservationExpiresAt ? `<p>Next reservation expiry: ${formatInventoryDate(item.nextReservationExpiresAt)}</p>` : ""}${item.reconciliationRequired ? `<p class="inventory-warning">${item.reconciliationCount} related order(s) require payment reconciliation. Payment references are not shown here.</p>` : ""}
      <form id="inventory-adjust-form" class="inventory-adjust-form" data-variant-id="${item.id}"><h4>Adjust available stock</h4><p>Use a positive number to add units and a negative number to remove units. This does not change active reservations.</p><label>Change in units<input name="delta" type="number" step="1" min="${minDelta}" max="${maxDelta}" required placeholder="e.g. 10 or -3"></label><label>Reason<textarea name="reason" minlength="3" maxlength="500" required></textarea></label><button class="button button--primary" type="submit">Review adjustment</button></form>
      <div class="inventory-history"><h4>Recent adjustments</h4>${history || '<p class="products-empty">No manual adjustments recorded.</p>'}</div></section>`;
  }

  async function loadInventory() {
    showOnly(elements.inventory);
    updateAdminViewButtons("inventory");
    elements.inventory.innerHTML = '<section class="state-card" role="status"><span class="loading-mark" aria-hidden="true"></span><p>Loading inventory…</p></section>';
    const params = new URLSearchParams({ page: String(inventoryPage), limit: String(inventoryLimit), status: inventoryStatus });
    if (inventoryQuery) params.set("q", inventoryQuery);
    if (inventoryLowStock) params.set("lowStock", "true");
    try {
      const response = await requestAdmin(`${inventoryUrl}?${params}`);
      if (!response) return;
      const result = await response.json();
      if (!response.ok || !result?.success || !Array.isArray(result.inventory) || !result.pagination) throw new Error(result?.message || "Inventory could not be loaded.");
      renderInventory(result);
    } catch (error) {
      elements.inventory.innerHTML = `<section class="state-card error-card" role="alert"><h2>Inventory could not be loaded</h2><p>${escapeAdminHtml(error.message || "Check your connection and try again.")}</p><button class="button button--secondary" type="button" data-inventory-retry>Try again</button></section>`;
    }
  }

  async function loadInventoryDetail(id) {
    try {
      const response = await requestAdmin(`${inventoryUrl}/${encodeURIComponent(id)}`);
      if (!response) return;
      const result = await response.json();
      if (!response.ok || !result?.success || !result.inventory || !Array.isArray(result.adjustments)) throw new Error(result?.message || "Inventory details could not be loaded.");
      inventorySelected = result;
      inventoryFeedback = "";
      await loadInventory();
    } catch (error) {
      inventoryFeedback = error.message || "Inventory details could not be loaded.";
      inventoryFeedbackKind = "error";
      await loadInventory();
    }
  }

  async function submitInventoryAdjustment(form) {
    const values = new FormData(form);
    const delta = Number(values.get("delta"));
    const reason = String(values.get("reason") || "").trim();
    if (!Number.isSafeInteger(delta) || delta === 0 || !reason) {
      inventoryFeedback = "Enter a nonzero whole number and a reason.";
      inventoryFeedbackKind = "error";
      await loadInventory();
      return;
    }
    if (!window.confirm(`Apply ${delta > 0 ? "+" : ""}${delta} available units? Reason: ${reason}`)) return;
    const variantId = form.dataset.variantId;
    try {
      const response = await requestAdmin(`${inventoryUrl}/${encodeURIComponent(variantId)}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, reason }),
      });
      if (!response) return;
      const result = await response.json();
      if (!response.ok || !result?.success || !result.inventory) throw new Error(result?.message || "The adjustment could not be applied.");
      inventorySelected = result;
      inventoryFeedback = `Inventory adjusted by ${delta > 0 ? "+" : ""}${delta} units.`;
      inventoryFeedbackKind = "success";
      await loadInventory();
    } catch (error) {
      inventoryFeedback = error.message || "The adjustment could not be applied. Reload and try again.";
      inventoryFeedbackKind = "error";
      await loadInventory();
    }
  }

  function renderProductEditor(product) {
    const creating = !product;
    const value = (key) => escapeAdminHtml(product?.[key] ?? "");
    const priceValue = creating ? "" : formatKoboInput(product.basePrice);
    const checked = (key, fallback) => (product ? product[key] : fallback) ? "checked" : "";
    const variantRows = (product?.variants || []).map((variant) => `
      <article class="variant-admin-row">
        <div><strong>${escapeAdminHtml(variant.size)} · ${escapeAdminHtml(variant.color)}</strong><span>${productPriceSummary(variant.price)} · Stock ${variant.stock} (read-only)</span></div>
        <span class="status-pill ${variant.active ? "status-pill--active" : "status-pill--inactive"}">${variant.active ? "Active" : "Inactive"}</span>
        <button class="button button--secondary" type="button" data-variant-edit="${escapeAdminHtml(variant.id)}">Edit</button>
      </article>`).join("");
    return `
      <section class="product-editor" aria-labelledby="product-editor-title">
        <div class="product-editor__heading"><div><p class="eyebrow">${creating ? "NEW CATALOG ITEM" : "EDIT CATALOG ITEM"}</p><h3 id="product-editor-title">${creating ? "Create product" : escapeAdminHtml(product.name)}</h3></div><button class="button button--secondary" type="button" data-product-editor-close>Close</button></div>
        <form id="product-editor-form" class="catalog-form" data-product-id="${creating ? "" : product.id}">
          <label>Product name<input name="name" maxlength="255" required value="${value("name")}"></label>
          <label>Description<textarea name="description" maxlength="20000" required>${value("description")}</textarea></label>
          <label>Category<input name="category" maxlength="100" required value="${value("category")}"></label>
          <label>Gender<input name="gender" maxlength="20" required value="${value("gender")}"></label>
          <label>Base price (NGN)<input name="basePriceNaira" inputmode="decimal" required placeholder="45000.00" value="${escapeAdminHtml(priceValue)}"><small>Sent to the API as integer kobo.</small></label>
          <label>Image URL<input name="image" type="url" maxlength="500" required value="${value("image")}"></label>
          <label>Image alt text<input name="imageAlt" maxlength="255" required value="${value("imageAlt")}"></label>
          <div class="catalog-form__checks"><label><input name="featured" type="checkbox" ${checked("featured", false)}> Featured</label><label><input name="newArrival" type="checkbox" ${checked("newArrival", false)}> New arrival</label><label><input name="active" type="checkbox" ${checked("active", true)}> Active</label></div>
          <div class="catalog-form__actions"><button class="button button--primary" type="submit">${creating ? "Create product" : "Save changes"}</button></div>
        </form>
        ${product ? `<div class="variant-editor"><div class="variant-editor__heading"><div><p class="eyebrow">OPTIONS</p><h4>Variants</h4><p>New variants start with zero stock. Inventory is managed separately.</p></div><button class="button button--secondary" type="button" data-variant-create>Add variant</button></div><div class="variant-admin-list">${variantRows || '<p class="products-empty">No variants yet.</p>'}</div>${variantEditing ? renderVariantEditor(product, variantEditing) : ""}</div>` : '<p class="variant-boundary-note">Save the product first, then add its size and color variants. New variants start at zero stock.</p>'}
      </section>`;
  }

  function renderVariantEditor(product, variant) {
    const creating = !variant || variant.creating === true;
    return `<form id="variant-editor-form" class="variant-form" data-variant-id="${creating ? "" : variant.id}">
      <h4>${creating ? "Add variant" : `Edit ${escapeAdminHtml(variant.size)} · ${escapeAdminHtml(variant.color)}`}</h4>
      <label>Size<input name="size" maxlength="20" required value="${escapeAdminHtml(variant?.size || "")}"></label>
      <label>Color<input name="color" maxlength="50" required value="${escapeAdminHtml(variant?.color || "")}"></label>
      <label>Price (NGN)<input name="priceNaira" inputmode="decimal" required value="${variant ? escapeAdminHtml(formatKoboInput(variant.price)) : ""}"></label>
      <label class="variant-form__active"><input name="active" type="checkbox" ${variant?.active === false ? "" : "checked"}> Active</label>
      ${creating ? '<p class="variant-boundary-note">Stock is initialized to zero and cannot be changed here.</p>' : `<p class="variant-boundary-note">Current stock: ${variant.stock} (read-only)</p>`}
      <div class="catalog-form__actions"><button class="button button--primary" type="submit">${creating ? "Create variant" : "Save variant"}</button><button class="button button--secondary" type="button" data-variant-cancel>Cancel</button></div>
    </form>`;
  }

  async function requestAdmin(url, options = {}) {
    const method = options.method || "GET";
    const response = await apiRequest(url, { ...options, headers: adminHeaders(method, options.headers || {}) });
    if (response.status === 401) {
      showSignedOut("Your administrator session has expired. Sign in again to continue.");
      return null;
    }
    return response;
  }

  async function loadProducts() {
    showOnly(elements.products);
    updateAdminViewButtons("products");
    elements.products.innerHTML = '<section class="state-card" role="status"><span class="loading-mark" aria-hidden="true"></span><p>Loading products…</p></section>';
    const params = new URLSearchParams({ page: String(productPage), limit: String(productLimit), active: productActiveFilter });
    if (productQuery) params.set("q", productQuery);
    try {
      const response = await requestAdmin(`${productsUrl}?${params}`);
      if (!response) return;
      const result = await response.json();
      if (!response.ok || !result?.success || !Array.isArray(result.products) || !result.pagination) throw new Error(result?.message || "Products could not be loaded. Try again.");
      renderProductManagement(result);
    } catch (error) {
      elements.products.innerHTML = `<section class="state-card error-card" role="alert"><h2>Products could not be loaded</h2><p>${escapeAdminHtml(error.message || "Check your connection and try again.")}</p><button class="button button--secondary" type="button" data-products-retry>Try again</button></section>`;
    }
  }

  async function loadProductEditor(id) {
    try {
      const response = await requestAdmin(`${productsUrl}/${id}`);
      if (!response) return;
      const result = await response.json();
      if (!response.ok || !result?.success || !result.product) {
        showProductFeedback(result?.message || "Product could not be loaded.", "error");
        return;
      }
      productEditing = result.product;
      variantEditing = null;
      await loadProducts();
    } catch (error) { showProductFeedback(error.message || "Product could not be loaded.", "error"); }
  }

  function productMutationBody(form) {
    const values = new FormData(form);
    const price = parseNairaInput(values.get("basePriceNaira"));
    return {
      name: values.get("name"), description: values.get("description"), category: values.get("category"),
      gender: values.get("gender"), basePrice: price, image: values.get("image"), imageAlt: values.get("imageAlt"),
      featured: values.has("featured"), newArrival: values.has("newArrival"), active: values.has("active"),
    };
  }

  function variantMutationBody(form) {
    const values = new FormData(form);
    return { size: values.get("size"), color: values.get("color"), price: parseNairaInput(values.get("priceNaira")), active: values.has("active") };
  }

  async function saveProduct(form) {
    let body;
    try { body = productMutationBody(form); } catch (error) { showProductFeedback(error.message, "error"); return; }
    const editingId = form.dataset.productId;
    if (editingId && productEditing?.active && !body.active && !window.confirm("Deactivate this product? It will no longer appear in the public catalog.")) return;
    try {
      const response = await requestAdmin(editingId ? `${productsUrl}/${editingId}` : productsUrl, {
        method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response) return;
      const result = await response.json();
      if (!response.ok || !result?.success || !result.product) { showProductFeedback(result?.message || "Product could not be saved.", "error"); return; }
      productEditing = result.product;
      variantEditing = null;
      productFeedbackKind = "success";
      productFeedback = editingId ? "Product changes saved." : "Product created. Add variants below; their stock starts at zero.";
      await loadProducts();
    } catch (error) { showProductFeedback(error.message || "Product could not be saved. Check your connection.", "error"); }
  }

  async function saveVariant(form) {
    let body;
    try { body = variantMutationBody(form); } catch (error) { showProductFeedback(error.message, "error"); return; }
    const variantId = form.dataset.variantId;
    if (variantId) {
      const existing = productEditing.variants.find((item) => String(item.id) === variantId);
      if (existing?.active && !body.active && !window.confirm("Deactivate this variant? It will no longer be available for new orders.")) return;
    }
    const url = variantId ? `${productsUrl}/${productEditing.id}/variants/${variantId}` : `${productsUrl}/${productEditing.id}/variants`;
    try {
      const response = await requestAdmin(url, { method: variantId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response) return;
      const result = await response.json();
      if (!response.ok || !result?.success) { showProductFeedback(result?.message || "Variant could not be saved.", "error"); return; }
      productFeedback = variantId ? "Variant changes saved." : "Variant created with zero stock.";
      productFeedbackKind = "success";
      await loadProductEditor(productEditing.id);
    } catch (error) { showProductFeedback(error.message || "Variant could not be saved. Check your connection.", "error"); }
  }

  elements.nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-view]");
    if (!button) return;
    if (button.dataset.adminView === "products") loadProducts();
    else if (button.dataset.adminView === "inventory") loadInventory();
    else { updateAdminViewButtons("dashboard"); loadDashboard(); }
  });

  elements.products.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.id === "products-search-form") {
      const values = new FormData(event.target);
      productQuery = String(values.get("q") || "").trim();
      productActiveFilter = String(values.get("active") || "all");
      productPage = 1;
      productEditing = null;
      productFeedback = "";
      await loadProducts();
    } else if (event.target.id === "product-editor-form") await saveProduct(event.target);
    else if (event.target.id === "variant-editor-form") await saveVariant(event.target);
  });

  elements.products.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-product-edit]");
    if (edit) { await loadProductEditor(edit.dataset.productEdit); return; }
    if (event.target.closest("[data-product-create]")) { productEditing = null; variantEditing = null; await loadProducts(); return; }
    if (event.target.closest("[data-product-editor-close]")) { productEditing = null; variantEditing = null; await loadProducts(); return; }
    if (event.target.closest("[data-variant-create]")) { variantEditing = { creating: true }; await loadProducts(); return; }
    const variantButton = event.target.closest("[data-variant-edit]");
    if (variantButton) { variantEditing = productEditing.variants.find((item) => String(item.id) === variantButton.dataset.variantEdit) || null; await loadProducts(); return; }
    if (event.target.closest("[data-variant-cancel]")) { variantEditing = null; await loadProducts(); return; }
    if (event.target.closest("[data-products-retry]")) { await loadProducts(); return; }
    const pageButton = event.target.closest("[data-product-page]");
    if (pageButton && !pageButton.disabled) { productPage = Number(pageButton.dataset.productPage); await loadProducts(); }
  });

  elements.inventory.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.id === "inventory-search-form") {
      const values = new FormData(event.target);
      inventoryQuery = String(values.get("q") || "").trim();
      inventoryStatus = String(values.get("status") || "all");
      inventoryLowStock = values.has("lowStock");
      inventoryPage = 1;
      inventorySelected = null;
      inventoryFeedback = "";
      await loadInventory();
    } else if (event.target.id === "inventory-adjust-form") await submitInventoryAdjustment(event.target);
  });

  elements.inventory.addEventListener("click", async (event) => {
    const open = event.target.closest("[data-inventory-open]");
    if (open) { await loadInventoryDetail(open.dataset.inventoryOpen); return; }
    if (event.target.closest("[data-inventory-close]")) { inventorySelected = null; await loadInventory(); return; }
    if (event.target.closest("[data-inventory-retry]")) { await loadInventory(); return; }
    const pageButton = event.target.closest("[data-inventory-page]");
    if (pageButton && !pageButton.disabled) { inventoryPage = Number(pageButton.dataset.inventoryPage); await loadInventory(); }
  });

  function renderDashboard(data) {
    if (!validDashboard(data)) throw new Error("The dashboard response was incomplete.");
    document.querySelector("#metric-orders-total").textContent = data.orders.total.toLocaleString("en-NG");
    document.querySelector("#metric-orders-pending").textContent = data.orders.pending.toLocaleString("en-NG");
    document.querySelector("#metric-orders-paid").textContent = data.orders.paid.toLocaleString("en-NG");
    document.querySelector("#metric-revenue").textContent = formatNairaFromKobo(data.revenue.successfulKobo);
    document.querySelector("#metric-customers").textContent = data.customers.total.toLocaleString("en-NG");
    document.querySelector("#metric-products").textContent = data.products.active.toLocaleString("en-NG");
    document.querySelector("#metric-low-stock").textContent = data.inventory.lowStockVariants.toLocaleString("en-NG");
    document.querySelector("#metric-stock-threshold").textContent = `At or below ${data.inventory.threshold} units`;
    const generated = new Date(data.generatedAt);
    document.querySelector("#generated-at").textContent = Number.isNaN(generated.getTime())
      ? "Latest available totals"
      : `Updated ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(generated)}`;
    showOnly(elements.dashboard);
  }

  async function loadDashboard() {
    showOnly(elements.loading);
    elements.logoutMessage.textContent = "";
    try {
      const response = await apiRequest(dashboardUrl);
      if (response.status === 401) {
        showSignedOut("Your administrator session has expired. Sign in again to continue.");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result?.success || !result.dashboard) {
        throw new Error(result?.message || "Dashboard could not be loaded. Try again.");
      }
      renderDashboard(result.dashboard);
    } catch (error) {
      showError(error.message || "Dashboard could not be loaded. Check your connection and try again.");
    }
  }

  async function checkAdminSession() {
    showOnly(elements.loading);
    try {
      const response = await apiRequest(`${authUrl}/me`);
      if (response.status === 401) {
        showSignedOut();
        return;
      }
      const result = await response.json();
      if (!response.ok || !result?.success || !result.admin || typeof result.csrfToken !== "string") {
        throw new Error(result?.message || "Administrator access could not be checked.");
      }
      authenticatedAdmin = result.admin;
      csrfToken = result.csrfToken;
      elements.identity.textContent = authenticatedAdmin.displayName;
      elements.identity.hidden = false;
      elements.logout.hidden = false;
      await loadDashboard();
    } catch (error) {
      showError(error.message || "Administrator access could not be checked. Try again.");
    }
  }

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(elements.loginForm);
    elements.loginButton.disabled = true;
    elements.signInMessage.textContent = "Signing in…";
    try {
      const response = await apiRequest(`${authUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email"), password: formData.get("password") }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success || !result.admin || typeof result.csrfToken !== "string") {
        throw new Error(result?.message || "Sign in failed. Check your details and try again.");
      }
      elements.loginForm.reset();
      authenticatedAdmin = result.admin;
      csrfToken = result.csrfToken;
      elements.identity.textContent = authenticatedAdmin.displayName;
      elements.identity.hidden = false;
      elements.logout.hidden = false;
      await loadDashboard();
    } catch (error) {
      showSignedOut(error.message || "Sign in failed. Check your connection and try again.");
    } finally {
      elements.loginButton.disabled = false;
    }
  });

  elements.retry.addEventListener("click", checkAdminSession);

  elements.logout.addEventListener("click", async () => {
    if (!csrfToken) {
      showSignedOut("Your administrator session has expired. Sign in again to continue.");
      return;
    }
    elements.logout.disabled = true;
    elements.logoutMessage.textContent = "Signing out…";
    try {
      const response = await apiRequest(`${authUrl}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: "{}",
      });
      if (response.status === 401) {
        showSignedOut("Your administrator session has ended.");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.message || "Logout failed. Try again.");
      showSignedOut("You have been signed out.");
    } catch (error) {
      elements.logoutMessage.textContent = error.message || "Logout failed. Check your connection and try again.";
    } finally {
      elements.logout.disabled = false;
    }
  });

  checkAdminSession();
})();
