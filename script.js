// Product records are loaded from the database-backed catalog API.
let products = [];

const localApiHostnames = ["localhost", "127.0.0.1"];
const localFrontendPorts = ["3000", "5500"];
const isLocalFrontend =
  localApiHostnames.includes(window.location.hostname) ||
  localFrontendPorts.includes(window.location.port);
const defaultApiBaseUrl = isLocalFrontend
  ? `http://${localApiHostnames.includes(window.location.hostname) ? "localhost" : window.location.hostname}:5000`
  : "";
const API_BASE_URL = String(
  window.HANIFS_API_BASE_URL || defaultApiBaseUrl,
).replace(/\/+$/, "");
const PRODUCTS_API_URL = `${API_BASE_URL}/api/products`;
const ORDERS_API_URL = `${API_BASE_URL}/api/orders`;
const PAYMENTS_API_URL = `${API_BASE_URL}/api/payments`;

// ============================================
// DOM Elements
// ============================================
const featuredProductsGrid = document.querySelector("#featured-products-grid");
const newArrivalsGrid = document.querySelector("#new-arrivals-grid");
const productSearch = document.querySelector("#product-search");
const categoryFilter = document.querySelector("#category-filter");
const genderFilter = document.querySelector("#gender-filter");
const sortProducts = document.querySelector("#sort-products");
const clearFilters = document.querySelector("#clear-filters");
const shopProductsGrid = document.querySelector("#shop-products-grid");
const productResultCount = document.querySelector("#product-result-count");
const catalogStatus = document.querySelector("#catalog-status");
const productModal = document.querySelector("#product-modal");
const productModalContent = document.querySelector("#product-modal-content");
const productModalClose = document.querySelector(".product-modal__close");
const productModalBackdrop = document.querySelector(".product-modal__backdrop");
const wishlistToggle = document.querySelector("#wishlist-toggle");
const wishlistCount = document.querySelector("#wishlist-count");
const wishlistDrawer = document.querySelector("#wishlist-drawer");
const wishlistItems = document.querySelector("#wishlist-items");
const wishlistClose = document.querySelector("#wishlist-close");
const wishlistDrawerBackdrop = document.querySelector(
  ".wishlist-drawer__backdrop",
);
const cartToggle = document.querySelector("#cart-toggle");
const cartCount = document.querySelector("#cart-count");
const cartDrawer = document.querySelector("#cart-drawer");
const cartDrawerItems = document.querySelector("#cart-drawer-items");
const cartDrawerSubtotal = document.querySelector("#cart-drawer-subtotal");
const cartClose = document.querySelector("#cart-close");
const cartDrawerBackdrop = document.querySelector(".cart-drawer__backdrop");
const cartPageItems = document.querySelector("#cart-page-items");
const cartPageSubtotal = document.querySelector("#cart-page-subtotal");
const cartPageTotal = document.querySelector("#cart-page-total");
const cartPageCheckout = document.querySelector("#cart-page-checkout");
const cartPageStatus = document.querySelector("#cart-page-status");
const checkoutContent = document.querySelector("#checkout-content");
let modalTrigger = null;

function mapApiProduct(apiProduct) {
  const variants = (Array.isArray(apiProduct.variants) ? apiProduct.variants : [])
    .filter((variant) => variant.active)
    .map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      price: variant.price,
      stock: variant.stock,
      active: variant.active,
    }));

  return {
    id: apiProduct.id,
    name: apiProduct.name,
    category: apiProduct.category,
    gender: apiProduct.gender,
    price: apiProduct.basePrice,
    image: apiProduct.imageUrl,
    alt: apiProduct.imageAlt,
    description: apiProduct.description,
    featured: apiProduct.featured,
    newArrival: apiProduct.newArrival,
    active: apiProduct.active,
    variants,
    sizes: [...new Set(variants.map((variant) => variant.size))],
    colors: [...new Set(variants.map((variant) => variant.color))],
  };
}

function setCatalogBusy(isBusy) {
  [featuredProductsGrid, newArrivalsGrid, shopProductsGrid].forEach((grid) => {
    grid?.setAttribute("aria-busy", String(isBusy));
  });
}

function setCatalogStatus(message, isError = false) {
  catalogStatus.textContent = message;
  catalogStatus.hidden = !message;
  catalogStatus.classList.toggle("catalog-status--error", isError);
  catalogStatus.setAttribute("role", isError ? "alert" : "status");
}

async function loadProducts() {
  setCatalogBusy(true);
  setCatalogStatus("Loading products...");

  try {
    const response = await fetch(PRODUCTS_API_URL, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error("Product request failed");
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.products)) {
      throw new Error("Product response is invalid");
    }

    products = payload.products
      .filter((product) => product && product.active)
      .map(mapApiProduct);

    loadWishlist();
    loadCart();
    updateWishlistCount();

    const featuredProducts = products.filter((product) => product.featured);
    const newArrivalProducts = products.filter((product) => product.newArrival);
    renderProducts(featuredProducts, featuredProductsGrid);
    renderProducts(newArrivalProducts, newArrivalsGrid);
    updateShopProducts();
    renderWishlist();
    updateWishlistButtons();
    updateCartViews();
    setCatalogStatus("");
  } catch {
    products = [];
    featuredProductsGrid.replaceChildren();
    newArrivalsGrid.replaceChildren();
    shopProductsGrid.replaceChildren();
    productResultCount.textContent = "";
    setCatalogStatus(
      "Products could not be loaded. Please refresh the page to try again.",
      true,
    );
  } finally {
    setCatalogBusy(false);
  }
}

// ============================================
// Wishlist State
// ============================================
const WISHLIST_STORAGE_KEY = "hanifs-store-wishlist";
let wishlist = [];

// ============================================
// Cart State and Storage
// ============================================
const CART_STORAGE_KEY = "hanifs-store-cart";
let cart = [];
let checkoutData = null;
let pendingOrder = null;
let isEditingCheckout = false;
let preparedOrderPayload = null;
let createdOrder = null;
let isCreatingOrder = false;
let pendingPaymentReference = null;
let isVerifyingPayment = false;

const nigerianStates = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  " Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

function getCartItemKey(productId, size, color) {
  return `${productId}::${size}::${color}`;
}

function loadCart() {
  try {
    const savedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
    if (!Array.isArray(savedCart)) {
      return;
    }

    cart = savedCart
      .map((item) => {
        const product = products.find(
          (entry) => String(entry.id) === String(item.productId),
        );
        const quantity = Math.max(1, Math.floor(Number(item.quantity)) || 1);
        if (!product || !item.size || !item.color) {
          return null;
        }
        const variant =
          product.variants.find(
            (entry) => String(entry.id) === String(item.variantId),
          ) ||
          product.variants.find(
            (entry) =>
              entry.size === String(item.size) &&
              entry.color === String(item.color),
          );
        if (!variant) {
          return null;
        }
        return {
          key: item.key || getCartItemKey(product.id, variant.size, variant.color),
          productId: product.id,
          variantId: variant.id,
          size: variant.size,
          color: variant.color,
          quantity,
        };
      })
      .filter(Boolean);
  } catch {
    cart = [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage may be unavailable in private or restricted browsing contexts.
  }
}

function getCartProduct(item) {
  return products.find(
    (product) => String(product.id) === String(item.productId),
  );
}

function getCartVariant(item) {
  const product = getCartProduct(item);
  if (!product) {
    return null;
  }

  return (
    product.variants.find(
      (variant) => String(variant.id) === String(item.variantId),
    ) ||
    product.variants.find(
      (variant) => variant.size === item.size && variant.color === item.color,
    ) ||
    null
  );
}

function getCartSubtotal() {
  return cart.reduce((subtotal, item) => {
    const variant = getCartVariant(item);
    return subtotal + (variant ? variant.price * item.quantity : 0);
  }, 0);
}

function updateCartCount() {
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  cartCount.textContent = String(itemCount);
  cartToggle.setAttribute(
    "aria-label",
    `View shopping bag (${itemCount} items)`,
  );
}

function addToCart(productId, variantId, quantity) {
  const product = products.find(
    (entry) => String(entry.id) === String(productId),
  );
  const variant = product?.variants.find(
    (entry) => String(entry.id) === String(variantId),
  );
  if (!product || !variant || !Number.isSafeInteger(quantity) || quantity < 1) {
    return false;
  }

  const key = getCartItemKey(product.id, variant.size, variant.color);
  const existingItem = cart.find((item) => item.key === key);
  if (existingItem && existingItem.quantity + quantity > variant.stock) {
    return false;
  }
  if (!existingItem && quantity > variant.stock) {
    return false;
  }
  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.variantId = variant.id;
  } else {
    cart.push({
      key,
      productId: product.id,
      variantId: variant.id,
      size: variant.size,
      color: variant.color,
      quantity,
    });
  }
  saveCart();
  updateCartViews();
  return true;
}

function updateCartItemQuantity(key, quantity) {
  const item = cart.find((entry) => entry.key === key);
  if (!item) {
    return;
  }
  const variant = getCartVariant(item);
  if (!variant || variant.stock < 1) {
    if (cartPageStatus) cartPageStatus.textContent = "This variant is currently out of stock. Remove it or choose another item.";
    return;
  }
  item.quantity = Math.min(Math.max(1, quantity), variant.stock);
  if (quantity > variant.stock && cartPageStatus) {
    cartPageStatus.textContent = `Only ${variant.stock} of this variant are currently available.`;
  }
  saveCart();
  updateCartViews();
}

function removeCartItem(key) {
  cart = cart.filter((item) => item.key !== key);
  saveCart();
  updateCartViews();
}

// ============================================
// Product Rendering
// ============================================
const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function formatPrice(price) {
  return nairaFormatter.format(price / 100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderProductCard(product) {
  const productName = escapeHtml(product.name);
  const category = escapeHtml(product.category);
  const saved = isProductInWishlist(product.id);
  const badge = product.newArrival
    ? '<span class="product-card__badge">NEW</span>'
    : "";

  return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <a class="product-card__link" href="#product-${escapeHtml(product.id)}">
        <div class="product-card__image">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
          ${badge}
        </div>
        <div class="product-card__details">
          <p class="product-card__category">${category}</p>
          <h3>${productName}</h3>
          <p class="price">${formatPrice(product.price)}</p>
        </div>
      </a>
      <button class="product-card__wishlist${saved ? " is-saved" : ""}" type="button" aria-label="${saved ? "Remove" : "Add"} ${productName} to wishlist" aria-pressed="${saved}" data-wishlist-product-id="${escapeHtml(product.id)}">
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M20.84 8.61a5.5 5.5 0 0 0-7.78-7.78L12 1.89l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 17.48Z"></path>
        </svg>
      </button>
    </article>`;
}

function renderProducts(
  productList,
  container,
  emptyMessage = "No products available at the moment.",
) {
  if (!container) {
    return;
  }

  container.innerHTML = productList.length
    ? productList.map(renderProductCard).join("")
    : `<p class="product-grid__empty">${escapeHtml(emptyMessage)}</p>`;
}

function renderCartItem(item, context) {
  const product = getCartProduct(item);
  const variant = getCartVariant(item);
  if (!product || !variant) {
    return "";
  }

  const lineTotal = variant.price * item.quantity;
  const pageClass = context === "page" ? " cart-item--page" : "";
  return `
    <article class="cart-item${pageClass}" data-cart-item-key="${escapeHtml(item.key)}">
      <img class="cart-item__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
      <div class="cart-item__details">
        <p class="cart-item__category">${escapeHtml(product.category)}</p>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="cart-item__variant">Size: ${escapeHtml(item.size)} &middot; Color: ${escapeHtml(item.color)}</p>
        ${variant.stock < 1 ? '<p class="cart-item__availability">Currently out of stock.</p>' : item.quantity > variant.stock ? `<p class="cart-item__availability">Only ${variant.stock} currently available.</p>` : ""}
        <div class="cart-item__meta">
          <span>Unit price: ${formatPrice(variant.price)}</span>
          ${context === "page" ? `<strong>Line total: ${formatPrice(lineTotal)}</strong>` : ""}
        </div>
        <div class="cart-item__actions">
          <div class="cart-item__quantity" aria-label="Quantity for ${escapeHtml(product.name)}">
            <button type="button" data-cart-action="decrease" data-cart-key="${escapeHtml(item.key)}" aria-label="Decrease quantity">-</button>
            <output aria-live="polite">${item.quantity}</output>
            <button type="button" data-cart-action="increase" data-cart-key="${escapeHtml(item.key)}" aria-label="Increase quantity">+</button>
          </div>
          <button class="cart-item__remove" type="button" data-cart-action="remove" data-cart-key="${escapeHtml(item.key)}" aria-label="Remove ${escapeHtml(product.name)} from cart">REMOVE</button>
        </div>
      </div>
    </article>`;
}

function renderCartDrawer() {
  if (!cart.length) {
    cartDrawerItems.innerHTML = `
      <div class="cart-drawer__empty">
        <p>YOUR BAG IS EMPTY</p>
        <span>Looks like you haven't added anything yet.</span>
        <a class="button button-secondary" href="#shop" data-close-cart>SHOP THE COLLECTION</a>
      </div>`;
  } else {
    cartDrawerItems.innerHTML = cart
      .map((item) => renderCartItem(item, "drawer"))
      .join("");
  }
  cartDrawerSubtotal.textContent = formatPrice(getCartSubtotal());
}

function renderCartPage() {
  if (!cart.length) {
    cartPageItems.innerHTML = `
      <div class="cart-page__empty">
        <h3>YOUR BAG IS EMPTY</h3>
        <p>Looks like you haven't added anything yet.</p>
        <a class="button button-primary" href="#shop">SHOP THE COLLECTION</a>
      </div>`;
  } else {
    cartPageItems.innerHTML = cart
      .map((item) => renderCartItem(item, "page"))
      .join("");
  }
  const subtotal = getCartSubtotal();
  cartPageSubtotal.textContent = formatPrice(subtotal);
  cartPageTotal.textContent = formatPrice(subtotal);
}

function updateCartViews() {
  updateCartCount();
  renderCartDrawer();
  renderCartPage();
  renderCheckoutPage();
}

// ============================================
// Checkout Rendering and Validation
// ============================================
function renderCheckoutSummary() {
  const subtotal = getCartSubtotal();
  return `
    <aside class="checkout-summary" aria-labelledby="checkout-summary-title">
      <h2 id="checkout-summary-title">ORDER SUMMARY</h2>
      <div class="checkout-summary__items">
        ${cart
          .map((item) => {
            const product = getCartProduct(item);
            const variant = getCartVariant(item);
            return product && variant
              ? `<article class="checkout-summary__item">
                <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
                <div><h3>${escapeHtml(product.name)}</h3><p>Size: ${escapeHtml(item.size)} · Color: ${escapeHtml(item.color)}</p><p>Qty: ${item.quantity} · ${formatPrice(variant.price)}</p></div>
                <strong>${formatPrice(variant.price * item.quantity)}</strong>
              </article>`
              : "";
          })
          .join("")}
      </div>
      <dl>
        <div><dt>Subtotal</dt><dd>${formatPrice(subtotal)}</dd></div>
        <div><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
        <div class="checkout-summary__total"><dt>Total</dt><dd>${formatPrice(subtotal)}</dd></div>
      </dl>
    </aside>`;
}

function renderCheckoutPage() {
  if (!cart.length) {
    checkoutContent.innerHTML = `
      <div class="checkout-empty">
        <h2 id="checkout-title">YOUR BAG IS EMPTY</h2>
        <p>Add products to your bag before continuing to checkout.</p>
        <a class="button button-primary" href="#shop">SHOP THE COLLECTION</a>
      </div>`;
    return;
  }

  if (checkoutData && !isEditingCheckout) {
    renderReviewPage();
    return;
  }

  checkoutContent.innerHTML = `
    <div class="checkout-page__header">
      <a class="checkout-page__return" href="#cart-page">&larr; RETURN TO CART</a>
      <h2 id="checkout-title">CHECKOUT</h2>
      <p>Complete your details before continuing to payment.</p>
    </div>
    <div class="checkout-layout">
      <form class="checkout-form" id="checkout-form" novalidate>
        <fieldset>
          <legend>CONTACT INFORMATION</legend>
          <div class="checkout-field">
            <label for="checkout-email">Email address</label>
            <input type="email" id="checkout-email" name="email" autocomplete="email" required aria-describedby="checkout-email-error">
            <p class="checkout-field__error" id="checkout-email-error" role="alert"></p>
          </div>
        </fieldset>
        <fieldset>
          <legend>DELIVERY INFORMATION</legend>
          <div class="checkout-form__grid">
            ${renderCheckoutField("first-name", "First name", "text", "given-name")}
            ${renderCheckoutField("last-name", "Last name", "text", "family-name")}
            ${renderCheckoutField("phone", "Phone number", "tel", "tel")}
            ${renderCheckoutField("address", "Street address", "text", "street-address", "checkout-form__field--full")}
            ${renderCheckoutField("city", "City", "text", "address-level2")}
            <div class="checkout-field">
              <label for="checkout-state">State</label>
              <select id="checkout-state" name="state" required aria-describedby="checkout-state-error">
                <option value="">Select state</option>
                ${nigerianStates.map((state) => `<option value="${escapeHtml(state.trim())}">${escapeHtml(state.trim())}</option>`).join("")}
              </select>
              <p class="checkout-field__error" id="checkout-state-error" role="alert"></p>
            </div>
            <div class="checkout-field">
              <label for="checkout-country">Country</label>
              <select id="checkout-country" name="country" required aria-describedby="checkout-country-error">
                <option value="Nigeria">Nigeria</option>
              </select>
              <p class="checkout-field__error" id="checkout-country-error" role="alert"></p>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>DELIVERY METHOD</legend>
          <label class="checkout-method"><input type="radio" name="deliveryMethod" value="standard" checked> <span>Standard delivery</span><small>Calculated later</small></label>
        </fieldset>
        <button class="button button-primary checkout-form__submit" type="submit">CONTINUE TO PAYMENT</button>
        <p class="checkout-form__status" id="checkout-form-status" role="status" aria-live="polite"></p>
      </form>
      ${renderCheckoutSummary()}
    </div>`;

  if (checkoutData) {
    const savedValues = {
      email: checkoutData.customer.email,
      "first-name": checkoutData.customer.firstName,
      "last-name": checkoutData.customer.lastName,
      phone: checkoutData.customer.phone,
      address: checkoutData.shipping.address,
      city: checkoutData.shipping.city,
      state: checkoutData.shipping.state,
      country: checkoutData.shipping.country,
    };
    Object.entries(savedValues).forEach(([fieldName, value]) => {
      const field = document.querySelector(`#checkout-${fieldName}`);
      if (field) field.value = value;
    });
  }
}

// Client-side totals and customer data are not authoritative. The future backend
// must validate products, prices, quantities, stock, delivery fees, and totals.
// Customer data must eventually be sent over HTTPS; payment confirmation must
// come from a trusted provider/backend flow, never from browser state.
function buildPendingOrder() {
  const subtotal = getCartSubtotal();
  return {
    items: cart
      .map((item) => {
        const product = getCartProduct(item);
        const variant = getCartVariant(item);
        return product && variant
          ? {
              productId: product.id,
              productVariantId: variant.id,
              name: product.name,
              price: variant.price,
              quantity: item.quantity,
              size: item.size,
              color: item.color,
            }
          : null;
      })
      .filter(Boolean),
    customer: { ...checkoutData.customer },
    shipping: { ...checkoutData.shipping },
    pricing: { subtotal, delivery: 0, total: subtotal },
  };
}

// This payload contains customer intent only. It deliberately excludes prices,
// totals, payment status, and order status until the backend validates the request.
function buildOrderPayload() {
  return {
    items: cart.map((item) => ({
      productVariantId: item.variantId,
      quantity: item.quantity,
    })),
    customer: { ...checkoutData.customer },
    shipping: { ...checkoutData.shipping },
  };
}

function renderReviewPage() {
  pendingOrder = buildPendingOrder();
  checkoutContent.innerHTML = `
    <div class="checkout-page__header">
      <button class="checkout-page__return" type="button" data-review-action="edit" ${createdOrder ? "disabled" : ""}>&larr; EDIT INFORMATION</button>
      <h2 id="checkout-title">REVIEW YOUR ORDER</h2>
      <p>Review your information and items before continuing to payment.</p>
    </div>
    <div class="review-layout">
      <div class="review-details">
        <section class="review-block" aria-labelledby="review-contact-title">
          <h3 id="review-contact-title">CONTACT</h3>
          <p>${escapeHtml(pendingOrder.customer.email)}</p>
        </section>
        <section class="review-block" aria-labelledby="review-delivery-title">
          <h3 id="review-delivery-title">DELIVERY ADDRESS</h3>
          <p>${escapeHtml(pendingOrder.customer.firstName)} ${escapeHtml(pendingOrder.customer.lastName)}<br>${escapeHtml(pendingOrder.shipping.address)}<br>${escapeHtml(pendingOrder.shipping.city)}, ${escapeHtml(pendingOrder.shipping.state)}<br>${escapeHtml(pendingOrder.shipping.country)}<br>${escapeHtml(pendingOrder.customer.phone)}</p>
        </section>
        <section class="review-block" aria-labelledby="review-items-title">
          <h3 id="review-items-title">YOUR ITEMS</h3>
          <div class="review-items">
            ${pendingOrder.items.map((item) => `<article class="review-item"><div><h4>${escapeHtml(item.name)}</h4><p>Size: ${escapeHtml(item.size)} · Color: ${escapeHtml(item.color)} · Qty: ${item.quantity}</p></div><strong>${formatPrice(item.price * item.quantity)}</strong></article>`).join("")}
          </div>
        </section>
      </div>
      <aside class="review-summary" aria-labelledby="review-summary-title">
        <h3 id="review-summary-title">ORDER SUMMARY</h3>
        <dl>
          <div><dt>Subtotal</dt><dd>${formatPrice(pendingOrder.pricing.subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
          <div class="review-summary__total"><dt>Total</dt><dd>${formatPrice(pendingOrder.pricing.total)}</dd></div>
        </dl>
        <button class="button button-primary" type="button" data-review-action="payment" ${isCreatingOrder ? "disabled" : ""}>${createdOrder ? "RETRY PAYMENT" : "CONTINUE TO PAYMENT"}</button>
        <a class="button button-secondary" href="#cart-page">RETURN TO CART</a>
        <p class="review-summary__status" id="review-summary-status" role="status" aria-live="polite"></p>
      </aside>
    </div>`;
}

function renderCheckoutField(id, label, type, autocomplete, extraClass = "") {
  return `<div class="checkout-field ${extraClass}">
    <label for="checkout-${id}">${label}</label>
    <input type="${type}" id="checkout-${id}" name="${id}" autocomplete="${autocomplete}" required aria-describedby="checkout-${id}-error">
    <p class="checkout-field__error" id="checkout-${id}-error" role="alert"></p>
  </div>`;
}

function validateCheckoutForm(form) {
  const fields = [
    "email",
    "first-name",
    "last-name",
    "phone",
    "address",
    "city",
    "state",
    "country",
  ];
  let isValid = true;

  fields.forEach((fieldName) => {
    const field = form.elements[fieldName];
    const error = document.querySelector(`#checkout-${fieldName}-error`);
    let message = "";
    if (!field.value.trim()) {
      message = "This field is required.";
    } else if (fieldName === "email" && !field.validity.valid) {
      message = "Enter a valid email address.";
    } else if (
      fieldName === "phone" &&
      !/^[0-9+()\s-]{7,}$/.test(field.value.trim())
    ) {
      message = "Enter a valid phone number.";
    }
    error.textContent = message;
    field.setAttribute("aria-invalid", String(Boolean(message)));
    if (message) isValid = false;
  });
  return isValid;
}

function handleCheckoutSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector("#checkout-form-status");
  if (!validateCheckoutForm(form)) {
    status.textContent = "Please review the highlighted fields.";
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    firstInvalid?.focus();
    return;
  }

  const values = Object.fromEntries(new FormData(form).entries());
  checkoutData = {
    customer: {
      email: values.email,
      firstName: values["first-name"],
      lastName: values["last-name"],
      phone: values.phone,
    },
    shipping: {
      address: values.address,
      city: values.city,
      state: values.state,
      country: values.country,
    },
  };
  isEditingCheckout = false;
  pendingOrder = buildPendingOrder();
  renderReviewPage();
}

async function submitReviewedOrder(button, status) {
  if (isCreatingOrder) return;
  isCreatingOrder = true;
  button.disabled = true;
  button.textContent = createdOrder ? "CONNECTING TO PAYSTACK…" : "SUBMITTING ORDER…";
  status.textContent = createdOrder
    ? "Connecting to the secure payment page…"
    : "Creating your order securely…";
  let redirecting = false;

  try {
    if (!createdOrder) {
      const orderResponse = await fetch(ORDERS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOrderPayload()),
      });
      const orderResult = await orderResponse.json().catch(() => null);
      if (!orderResponse.ok || !orderResult?.success || !orderResult.order?.id) {
        if (orderResponse.status === 400) {
          status.textContent = "Please check your contact details and selected items, then try again.";
        } else if (orderResponse.status === 404) {
          status.textContent = "A selected item is no longer available. Refresh your bag and try again.";
        } else if (orderResponse.status === 409) {
          status.textContent = "Some selected items are no longer available in those quantities. Update your bag and try again.";
        } else {
          status.textContent = "We could not create your order. Please try again.";
        }
        return;
      }
      createdOrder = orderResult.order;
    }

    status.textContent = "Preparing your secure Paystack checkout…";
    const paymentResponse = await fetch(`${PAYMENTS_API_URL}/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: createdOrder.id }),
    });
    const paymentResult = await paymentResponse.json().catch(() => null);
    const payment = paymentResult?.payment;
    if (!paymentResponse.ok || !paymentResult?.success || !payment?.authorizationUrl || !payment?.reference) {
      if (paymentResponse.status === 409 && paymentResult?.code === "inventory_unavailable") {
        createdOrder = null;
        checkoutContent.querySelector('[data-review-action="edit"]')?.removeAttribute("disabled");
        status.textContent = "A selected item became unavailable before payment. You were not charged. Update your bag and try again.";
      } else if (paymentResponse.status === 409) {
        status.textContent = "A payment session is already active for this order. Return from Paystack to verify it.";
      } else if (paymentResponse.status === 503 || paymentResponse.status === 502) {
        status.textContent = "Your order is saved, but the payment service is unavailable. Please retry shortly.";
      } else {
        status.textContent = "Your order is saved, but payment could not be started. Please retry.";
      }
      return;
    }

    let authorizationUrl;
    try {
      authorizationUrl = new URL(payment.authorizationUrl);
    } catch {
      status.textContent = "Your order is saved, but the payment page returned an invalid link.";
      return;
    }
    if (authorizationUrl.protocol !== "https:" || authorizationUrl.hostname !== "checkout.paystack.com") {
      status.textContent = "Your order is saved, but the payment page returned an invalid link.";
      return;
    }

    pendingPaymentReference = payment.reference;
    redirecting = true;
    window.location.assign(authorizationUrl.toString());
  } catch {
    status.textContent = createdOrder
      ? "Your order is saved, but we could not reach the payment service. Please retry."
      : "We could not reach the order service. Check your connection and try again.";
  } finally {
    isCreatingOrder = false;
    if (!redirecting) {
      button.disabled = false;
      button.textContent = createdOrder ? "RETRY PAYMENT" : "CONTINUE TO PAYMENT";
    }
  }
}

function renderPaymentReturn(message, isError = false, payment = null, canRetryPayment = false, showCartLink = false) {
  checkoutContent.innerHTML = `
    <div class="checkout-page__header">
      <h2 id="checkout-title">${isError ? "PAYMENT NOT CONFIRMED" : payment ? "PAYMENT CONFIRMED" : "VERIFYING PAYMENT"}</h2>
      <p>${escapeHtml(message)}</p>
    </div>
    ${payment ? `<div class="review-details"><p>Order: ${escapeHtml(payment.id)}</p><p>Reference: ${escapeHtml(payment.reference)}</p><p>Amount: ${formatPrice(payment.amount)}</p></div>` : ""}
    ${isError && canRetryPayment && payment ? `<button class="button button-primary" type="button" data-payment-init-retry data-order-id="${escapeHtml(payment.id)}">RETRY PAYMENT</button>` : ""}
    ${isError && !canRetryPayment && pendingPaymentReference ? '<button class="button button-primary" type="button" data-payment-retry>RETRY VERIFICATION</button>' : ""}
    ${showCartLink ? '<a class="button button-secondary" href="#cart-page">RETURN TO BAG</a>' : ""}`;
}

async function verifyReturnedPayment(reference) {
  if (isVerifyingPayment || !reference) return;
  isVerifyingPayment = true;
  pendingPaymentReference = reference;
  renderPaymentReturn("We are confirming your payment securely with Paystack.");

  try {
    const response = await fetch(`${PAYMENTS_API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    const result = await response.json().catch(() => null);
    const payment = result?.payment;
    if (
      response.ok && result?.success && payment?.verified === true &&
      payment.paymentStatus === "success" && payment.orderStatus === "paid"
    ) {
      createdOrder = { id: payment.id };
      cart = [];
      saveCart();
      updateCartViews();
      renderPaymentReturn("Payment confirmed. Your order is now paid.", false, payment);
      return;
    }

    if (result?.code === "payment_reconciliation_required") {
      pendingPaymentReference = null;
      renderPaymentReturn(
        "Paystack reported a successful payment, but the inventory reservation had ended. Your order was not marked paid. Contact support with the order and reference details for reconciliation.",
        true,
        payment,
      );
      return;
    }

    if (response.status === 409 && payment?.paymentStatus === "failed") {
      renderPaymentReturn(
        "Paystack reported that this payment failed. Your order remains unpaid; you can start another payment attempt.",
        true,
        payment,
        true,
      );
      return;
    }

    const message = response.status === 404
      ? "We could not match this payment reference to an order. Your order has not been marked paid."
      : response.status === 409
        ? "Paystack has not confirmed a successful payment for this order. You can retry verification."
        : "We could not verify your payment right now. Your order has not been marked paid; please retry.";
    renderPaymentReturn(message, true);
  } catch {
    renderPaymentReturn("We could not reach the payment service. Your order has not been marked paid; please retry.", true);
  } finally {
    isVerifyingPayment = false;
  }
}

async function retryPaystackPayment(orderId) {
  if (isVerifyingPayment || !orderId) return;
  isVerifyingPayment = true;
  renderPaymentReturn("Preparing a new secure payment session…");
  try {
    const response = await fetch(`${PAYMENTS_API_URL}/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const result = await response.json().catch(() => null);
    const payment = result?.payment;
    if (!response.ok || !result?.success || !payment?.authorizationUrl || !payment?.reference) {
      if (result?.code === "inventory_unavailable") {
        renderPaymentReturn(
          "Stock changed before payment could be retried. Return to your bag and update the unavailable items.",
          true,
          payment,
          false,
          true,
        );
      } else {
        renderPaymentReturn("We could not restart payment. Your order is still unpaid; please try again.", true, payment, true);
      }
      return;
    }

    let authorizationUrl;
    try {
      authorizationUrl = new URL(payment.authorizationUrl);
    } catch {
      renderPaymentReturn("The payment page returned an invalid link. Your order remains unpaid.", true, payment, true);
      return;
    }
    if (authorizationUrl.protocol !== "https:" || authorizationUrl.hostname !== "checkout.paystack.com") {
      renderPaymentReturn("The payment page returned an invalid link. Your order remains unpaid.", true, payment, true);
      return;
    }
    pendingPaymentReference = payment.reference;
    window.location.assign(authorizationUrl.toString());
  } catch {
    renderPaymentReturn("We could not reach the payment service. Your order remains unpaid; please retry.", true, { id: orderId }, true);
  } finally {
    isVerifyingPayment = false;
  }
}

function handlePaystackReturn() {
  const query = new URLSearchParams(window.location.search);
  const reference = query.get("reference") || query.get("trxref");
  if (!reference) return;

  pendingPaymentReference = reference;
  history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  window.location.hash = "checkout-page";
  verifyReturnedPayment(reference);
}

// ============================================
// Product Filtering and Sorting
// ============================================
function getFilteredProducts() {
  const searchQuery = productSearch.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedGender = genderFilter.value;
  const selectedSort = sortProducts.value;

  const filteredProducts = products.filter((product) => {
    const searchableText = [
      product.name,
      product.category,
      product.gender,
      product.description,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!searchQuery || searchableText.includes(searchQuery)) &&
      (selectedCategory === "all" || product.category === selectedCategory) &&
      (selectedGender === "all" || product.gender === selectedGender)
    );
  });

  const sortedProducts = [...filteredProducts];

  if (selectedSort === "name-ascending") {
    sortedProducts.sort((firstProduct, secondProduct) =>
      firstProduct.name.localeCompare(secondProduct.name),
    );
  } else if (selectedSort === "name-descending") {
    sortedProducts.sort((firstProduct, secondProduct) =>
      secondProduct.name.localeCompare(firstProduct.name),
    );
  } else if (selectedSort === "price-ascending") {
    sortedProducts.sort(
      (firstProduct, secondProduct) => firstProduct.price - secondProduct.price,
    );
  } else if (selectedSort === "price-descending") {
    sortedProducts.sort(
      (firstProduct, secondProduct) => secondProduct.price - firstProduct.price,
    );
  } else {
    sortedProducts.sort(
      (firstProduct, secondProduct) =>
        Number(secondProduct.featured) - Number(firstProduct.featured),
    );
  }

  return sortedProducts;
}

function updateShopProducts() {
  const matchingProducts = getFilteredProducts();
  const productLabel = matchingProducts.length === 1 ? "product" : "products";

  productResultCount.textContent = `${matchingProducts.length} ${productLabel} found`;
  renderProducts(
    matchingProducts,
    shopProductsGrid,
    "No products match your search.",
  );
}

// ============================================
// Wishlist Storage
// ============================================
function loadWishlist() {
  try {
    const savedWishlist = JSON.parse(
      localStorage.getItem(WISHLIST_STORAGE_KEY),
    );
    if (!Array.isArray(savedWishlist)) {
      return;
    }

    wishlist = [
      ...new Map(
        savedWishlist
          .map((savedId) =>
            products.find((product) => String(product.id) === String(savedId)),
          )
          .filter(Boolean)
          .map((product) => [String(product.id), product.id]),
      ).values(),
    ];
  } catch {
    wishlist = [];
  }
}

function saveWishlist() {
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
  } catch {
    // Storage may be unavailable in private or restricted browsing contexts.
  }
}

function isProductInWishlist(productId) {
  return wishlist.some((savedId) => String(savedId) === String(productId));
}

function updateWishlistCount() {
  wishlistCount.textContent = String(wishlist.length);
  wishlistToggle.setAttribute(
    "aria-label",
    `View wishlist (${wishlist.length} saved)`,
  );
}

function updateWishlistButtons() {
  document.querySelectorAll("[data-wishlist-product-id]").forEach((button) => {
    const product = products.find(
      (item) => String(item.id) === String(button.dataset.wishlistProductId),
    );
    const saved = product ? isProductInWishlist(product.id) : false;

    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute(
      "aria-label",
      `${saved ? "Remove" : "Add"} ${product ? product.name : "product"} to wishlist`,
    );
  });
}

function toggleWishlist(productId) {
  const product = products.find(
    (item) => String(item.id) === String(productId),
  );
  if (!product) {
    return;
  }

  if (isProductInWishlist(product.id)) {
    wishlist = wishlist.filter(
      (savedId) => String(savedId) !== String(product.id),
    );
  } else {
    wishlist = [...wishlist, product.id];
  }

  saveWishlist();
  updateWishlistCount();
  updateWishlistButtons();
  renderWishlist();
}

// ============================================
// Wishlist Rendering
// ============================================
function renderWishlist() {
  const savedProducts = wishlist
    .map((savedId) =>
      products.find((product) => String(product.id) === String(savedId)),
    )
    .filter(Boolean);

  if (!savedProducts.length) {
    wishlistItems.innerHTML = `
      <div class="wishlist-drawer__empty">
        <p>Your wishlist is empty.</p>
        <a class="button button-secondary" href="#shop" data-close-wishlist>CONTINUE SHOPPING</a>
      </div>`;
    return;
  }

  wishlistItems.innerHTML = savedProducts
    .map(
      (product) => `
        <article class="wishlist-item" data-wishlist-item-id="${escapeHtml(product.id)}">
          <img class="wishlist-item__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
          <div class="wishlist-item__details">
            <p class="wishlist-item__category">${escapeHtml(product.category)}</p>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="price">${formatPrice(product.price)}</p>
            <div class="wishlist-item__actions">
              <button type="button" class="wishlist-item__action" data-wishlist-action="details" data-product-id="${escapeHtml(product.id)}">VIEW DETAILS</button>
              <button type="button" class="wishlist-item__action" data-wishlist-action="add-to-cart" data-product-id="${escapeHtml(product.id)}">ADD TO CART</button>
              <button type="button" class="wishlist-item__remove" data-wishlist-action="remove" data-product-id="${escapeHtml(product.id)}" aria-label="Remove ${escapeHtml(product.name)} from wishlist">REMOVE</button>
            </div>
          </div>
        </article>`,
    )
    .join("");
}

function openWishlistDrawer() {
  if (!wishlistDrawer.hidden) {
    return;
  }

  if (!productModal.hidden) {
    closeProductModal();
  }

  renderWishlist();
  wishlistDrawer.hidden = false;
  wishlistDrawer.setAttribute("aria-hidden", "false");
  wishlistToggle.setAttribute("aria-expanded", "true");
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  wishlistClose.focus();
}

function closeWishlistDrawer() {
  wishlistDrawer.hidden = true;
  wishlistDrawer.setAttribute("aria-hidden", "true");
  wishlistToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = previousBodyOverflow;
  wishlistToggle.focus();
}

// ============================================
// Product Modal
// ============================================
let previousBodyOverflow = "";

function renderOptionButtons(options, optionType, selectedValue = "") {
  return options
    .map((option) => {
      const selected = selectedValue
        ? option === selectedValue
        : options.length === 1;
      return `
        <button
          class="product-modal__option${selected ? " is-selected" : ""}"
          type="button"
          data-option-type="${optionType}"
          data-option-value="${escapeHtml(option)}"
          aria-pressed="${selected}"
        >${escapeHtml(option)}</button>`;
    })
    .join("");
}

function getProductColorsForSize(product, size) {
  return [
    ...new Set(
      product.variants
        .filter((variant) => !size || variant.size === size)
        .map((variant) => variant.color),
    ),
  ];
}

function updateProductModalVariant(product) {
  const size = productModalContent.dataset.selectedSize || "";
  const color = productModalContent.dataset.selectedColor || "";
  const variant = product.variants.find(
    (entry) => entry.size === size && entry.color === color,
  );
  if (!variant) {
    delete productModalContent.dataset.variantId;
    const addButton = productModalContent.querySelector("[data-add-to-cart]");
    if (addButton) addButton.disabled = true;
    return null;
  }

  productModalContent.dataset.variantId = String(variant.id);
  const key = getCartItemKey(product.id, variant.size, variant.color);
  const alreadyInCart = cart.find((item) => item.key === key)?.quantity || 0;
  const availableToAdd = Math.max(0, variant.stock - alreadyInCart);
  productModalContent.dataset.maxAddQuantity = String(availableToAdd);
  const addButton = productModalContent.querySelector("[data-add-to-cart]");
  if (addButton) {
    addButton.disabled = availableToAdd < 1;
    addButton.textContent = availableToAdd < 1 ? "OUT OF STOCK" : "ADD TO CART";
  }
  const quantityOutput = productModalContent.querySelector("[data-quantity-value]");
  if (quantityOutput && availableToAdd > 0) {
    quantityOutput.textContent = String(Math.min(Number(quantityOutput.textContent) || 1, availableToAdd));
  }
  const status = productModalContent.querySelector(".product-modal__status");
  if (status) {
    status.textContent = availableToAdd < 1
      ? "No additional stock is available for this variant."
      : variant.stock <= 3
        ? `Only ${availableToAdd} available to add.`
        : "";
  }
  const price = productModalContent.querySelector("[data-product-modal-price]");
  if (price) {
    price.textContent = formatPrice(variant.price);
  }
  return variant;
}

function openProductModal(productId, trigger) {
  const product = products.find(
    (item) => String(item.id) === String(productId),
  );

  if (!product) {
    return;
  }

  modalTrigger = trigger || null;
  productModalContent.dataset.productId = product.id;
  const selectedSize = product.sizes.length === 1 ? product.sizes[0] : "";
  const initialColors = getProductColorsForSize(product, selectedSize);
  const selectedColor = initialColors.length === 1 ? initialColors[0] : "";
  productModalContent.dataset.selectedSize = selectedSize;
  productModalContent.dataset.selectedColor = selectedColor;
  delete productModalContent.dataset.variantId;
  productModalContent.innerHTML = `
    <div class="product-modal__layout">
      <div class="product-modal__image-wrap">
        <img class="product-modal__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
      </div>
      <div class="product-modal__details">
        <p class="product-modal__category">${escapeHtml(product.category)} / ${escapeHtml(product.gender)}</p>
        <h2 id="product-modal-title">${escapeHtml(product.name)}</h2>
        <p class="product-modal__price" data-product-modal-price>${formatPrice(product.price)}</p>
        <p class="product-modal__description">${escapeHtml(product.description)}</p>
        <div class="product-modal__field">
          <h3>SIZE</h3>
          <div class="product-modal__options" role="group" aria-label="Select size">
            ${renderOptionButtons(product.sizes, "size", selectedSize)}
          </div>
        </div>
        <div class="product-modal__field">
          <h3>COLOR</h3>
          <div class="product-modal__options" role="group" aria-label="Select color">
            ${renderOptionButtons(initialColors, "color", selectedColor)}
          </div>
        </div>
        <div class="product-modal__field product-modal__quantity-field">
          <h3>QUANTITY</h3>
          <div class="product-modal__quantity">
            <button type="button" data-quantity-action="decrease" aria-label="Decrease quantity">-</button>
            <output aria-live="polite" data-quantity-value>1</output>
            <button type="button" data-quantity-action="increase" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="button button-primary product-modal__add" type="button" data-add-to-cart${product.variants.length ? "" : " disabled"}>
          ${product.variants.length ? "ADD TO CART" : "UNAVAILABLE"}
        </button>
        <p class="product-modal__status" role="status" aria-live="polite">${product.variants.length ? "" : "No active variants are available."}</p>
      </div>
    </div>`;
  updateProductModalVariant(product);

  previousBodyOverflow = document.body.style.overflow;
  productModal.hidden = false;
  productModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  productModalClose.focus();
}

function closeProductModal() {
  productModal.hidden = true;
  productModal.setAttribute("aria-hidden", "true");
  productModalContent.replaceChildren();
  document.body.style.overflow = previousBodyOverflow;

  if (modalTrigger && document.contains(modalTrigger)) {
    modalTrigger.focus();
  }

  modalTrigger = null;
}

function openCartDrawer() {
  if (!cartDrawer.hidden) {
    return;
  }
  if (!wishlistDrawer.hidden) {
    closeWishlistDrawer();
  }
  if (!productModal.hidden) {
    closeProductModal();
  }

  renderCartDrawer();
  cartDrawer.hidden = false;
  cartDrawer.setAttribute("aria-hidden", "false");
  cartToggle.setAttribute("aria-expanded", "true");
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  cartClose.focus();
}

function closeCartDrawer() {
  cartDrawer.hidden = true;
  cartDrawer.setAttribute("aria-hidden", "true");
  cartToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = previousBodyOverflow;
  cartToggle.focus();
}

// ============================================
// Event Listeners
// ============================================
productSearch.addEventListener("input", updateShopProducts);
categoryFilter.addEventListener("change", updateShopProducts);
genderFilter.addEventListener("change", updateShopProducts);
sortProducts.addEventListener("change", updateShopProducts);
clearFilters.addEventListener("click", () => {
  productSearch.value = "";
  categoryFilter.value = "all";
  genderFilter.value = "all";
  sortProducts.value = "featured";
  updateShopProducts();
});

document.addEventListener("click", (event) => {
  const wishlistButton = event.target.closest(".product-card__wishlist");
  if (wishlistButton) {
    event.preventDefault();
    event.stopPropagation();
    toggleWishlist(wishlistButton.dataset.wishlistProductId);
    return;
  }

  const productLink = event.target.closest(".product-card__link");

  if (productLink) {
    event.preventDefault();
    openProductModal(
      productLink.closest(".product-card").dataset.productId,
      productLink,
    );
    return;
  }

  const optionButton = event.target.closest("[data-option-type]");
  if (optionButton) {
    const optionGroup = optionButton.parentElement;
    const product = products.find(
      (item) => String(item.id) === productModalContent.dataset.productId,
    );
    optionGroup.querySelectorAll("[data-option-type]").forEach((button) => {
      const isSelected = button === optionButton;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

    if (product && optionButton.dataset.optionType === "size") {
      const size = optionButton.dataset.optionValue;
      productModalContent.dataset.selectedSize = size;
      const colors = getProductColorsForSize(product, size);
      const currentColor = productModalContent.dataset.selectedColor;
      const color = colors.includes(currentColor)
        ? currentColor
        : colors.length === 1
          ? colors[0]
          : "";
      productModalContent.dataset.selectedColor = color;
      productModalContent.querySelector(
        '[data-option-type="color"]',
      ).parentElement.innerHTML = renderOptionButtons(colors, "color", color);
    } else if (product) {
      productModalContent.dataset.selectedColor =
        optionButton.dataset.optionValue;
    }

    if (product) {
      updateProductModalVariant(product);
    }
    return;
  }

  const quantityButton = event.target.closest("[data-quantity-action]");
  if (quantityButton) {
    const quantityOutput = productModalContent.querySelector(
      "[data-quantity-value]",
    );
    const currentQuantity = Number(quantityOutput.textContent);
    const direction =
      quantityButton.dataset.quantityAction === "increase" ? 1 : -1;
    quantityOutput.textContent = String(
      Math.min(
        Math.max(1, currentQuantity + direction),
        Number(productModalContent.dataset.maxAddQuantity) || 1,
      ),
    );
    return;
  }

  if (event.target.closest("[data-add-to-cart]")) {
    const quantity = Number(
      productModalContent.querySelector("[data-quantity-value]").textContent,
    );
    const status = productModalContent.querySelector(".product-modal__status");

    if (!productModalContent.dataset.variantId) {
      status.textContent = "Please select an available size and color.";
      return;
    }

    const added = addToCart(
      productModalContent.dataset.productId,
      productModalContent.dataset.variantId,
      quantity,
    );
    status.textContent = added
      ? "Added to your shopping bag."
      : "The requested quantity is no longer available. Update your bag and try again.";
    return;
  }

  const cartAction = event.target.closest("[data-cart-action]");
  if (cartAction) {
    const item = cart.find((entry) => entry.key === cartAction.dataset.cartKey);
    if (cartAction.dataset.cartAction === "remove") {
      removeCartItem(cartAction.dataset.cartKey);
    } else if (item) {
      const direction = cartAction.dataset.cartAction === "increase" ? 1 : -1;
      updateCartItemQuantity(item.key, Math.max(1, item.quantity + direction));
    }
    return;
  }

  if (event.target.closest("[data-close-cart]")) {
    closeCartDrawer();
    return;
  }

  if (event.target.closest("[data-payment-retry]")) {
    verifyReturnedPayment(pendingPaymentReference);
    return;
  }

  const paymentRetryAction = event.target.closest("[data-payment-init-retry]");
  if (paymentRetryAction) {
    retryPaystackPayment(paymentRetryAction.dataset.orderId);
    return;
  }

  const reviewAction = event.target.closest("[data-review-action]");
  if (reviewAction) {
    if (reviewAction.dataset.reviewAction === "edit") {
      if (createdOrder || isCreatingOrder) return;
      isEditingCheckout = true;
      renderCheckoutPage();
    } else if (reviewAction.dataset.reviewAction === "payment") {
      const reviewStatus = document.querySelector("#review-summary-status");
      const submitButton = reviewAction;
      if (!reviewStatus || isCreatingOrder) return;
      if (!cart.length || !checkoutData || !pendingOrder) {
        reviewStatus.textContent =
          "Please complete checkout information before continuing.";
        return;
      }
      submitReviewedOrder(submitButton, reviewStatus);
    }
    return;
  }

  const wishlistAction = event.target.closest("[data-wishlist-action]");
  if (wishlistAction) {
    const productId = wishlistAction.dataset.productId;
    const action = wishlistAction.dataset.wishlistAction;

    if (action === "remove") {
      toggleWishlist(productId);
    } else if (action === "details") {
      closeWishlistDrawer();
      openProductModal(productId, wishlistAction);
    } else if (action === "add-to-cart") {
      closeWishlistDrawer();
      openProductModal(productId, wishlistAction);
    }
    return;
  }

  if (event.target.closest("[data-close-wishlist]")) {
    closeWishlistDrawer();
  }
});

productModalClose.addEventListener("click", closeProductModal);
productModalBackdrop.addEventListener("click", closeProductModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !productModal.hidden) {
    closeProductModal();
  } else if (event.key === "Escape" && !wishlistDrawer.hidden) {
    closeWishlistDrawer();
  } else if (event.key === "Escape" && !cartDrawer.hidden) {
    closeCartDrawer();
  }
});

wishlistToggle.addEventListener("click", openWishlistDrawer);
wishlistClose.addEventListener("click", closeWishlistDrawer);
wishlistDrawerBackdrop.addEventListener("click", closeWishlistDrawer);
cartToggle.addEventListener("click", openCartDrawer);
cartClose.addEventListener("click", closeCartDrawer);
cartDrawerBackdrop.addEventListener("click", closeCartDrawer);
document.addEventListener("submit", (event) => {
  if (event.target.id === "checkout-form") {
    handleCheckoutSubmit(event);
  }
});
document.addEventListener("input", (event) => {
  if (event.target.closest("#checkout-form")) {
    const error = document.querySelector(`#${event.target.id}-error`);
    if (error && event.target.value.trim()) {
      error.textContent = "";
      event.target.setAttribute("aria-invalid", "false");
    }
  }
});

// ============================================
// Initialization
// ============================================
loadProducts().then(handlePaystackReturn);
