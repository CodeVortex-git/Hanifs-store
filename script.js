// Central product catalog
// This demo data will eventually be replaced by products retrieved from the backend API.
const products = [
  {
    id: 1,
    name: "Essential Cotton Tee",
    category: "Clothing",
    gender: "Men",
    price: 45000,
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=85",
    alt: "White cotton crew-neck tee on a model",
    description: "A clean everyday tee made from soft, breathable cotton.",
    sizes: ["S", "M", "L", "XL"],
    colors: ["White", "Black", "Grey"],
    featured: true,
    newArrival: false,
  },
  {
    id: 2,
    name: "Tailored Linen Shirt",
    category: "Clothing",
    gender: "Men",
    price: 78000,
    image:
      "https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?auto=format&fit=crop&w=800&q=85",
    alt: "Tailored beige linen shirt styled for men",
    description: "A polished linen shirt with an easy tailored silhouette.",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Beige", "White", "Navy"],
    featured: true,
    newArrival: false,
  },
  {
    id: 3,
    name: "Silk Satin Evening Dress",
    category: "Clothing",
    gender: "Women",
    price: 125000,
    image:
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=85",
    alt: "Elegant black satin dress on a model",
    description: "An elegant satin dress designed for refined occasions.",
    sizes: ["XS", "S", "M", "L"],
    colors: ["Black", "Champagne", "Emerald"],
    featured: true,
    newArrival: false,
  },
  {
    id: 4,
    name: "Pleated Midi Skirt",
    category: "Clothing",
    gender: "Women",
    price: 68500,
    image:
      "https://images.unsplash.com/photo-1583496661160-fb5886a13d27?auto=format&fit=crop&w=800&q=85",
    alt: "Woman wearing a pleated neutral midi skirt",
    description: "A fluid pleated skirt with a graceful midi length.",
    sizes: ["XS", "S", "M", "L"],
    colors: ["Taupe", "Black", "Ivory"],
    featured: true,
    newArrival: false,
  },
  {
    id: 5,
    name: "Relaxed Fit Oxford Shirt",
    category: "Clothing",
    gender: "Men",
    price: 65000,
    image:
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=85",
    alt: "Relaxed fit blue Oxford shirt on a model",
    description: "A relaxed Oxford shirt for effortless everyday dressing.",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Blue", "White", "Stone"],
    featured: false,
    newArrival: true,
  },
  {
    id: 6,
    name: "Ribbed Knit Dress",
    category: "Clothing",
    gender: "Women",
    price: 88000,
    image:
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=85",
    alt: "Woman wearing a minimalist ribbed knit dress",
    description:
      "A softly structured knit dress with a refined ribbed texture.",
    sizes: ["XS", "S", "M", "L"],
    colors: ["Black", "Cream", "Camel"],
    featured: false,
    newArrival: true,
  },
  {
    id: 7,
    name: "Premium Cotton Overshirt",
    category: "Clothing",
    gender: "Men",
    price: 82500,
    image:
      "https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=800&q=85",
    alt: "Premium cotton overshirt in a warm neutral shade",
    description: "A versatile cotton overshirt for layered daily looks.",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Camel", "Black", "Olive"],
    featured: false,
    newArrival: true,
  },
  {
    id: 8,
    name: "City Wool Trousers",
    category: "Clothing",
    gender: "Men",
    price: 89500,
    image:
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=85",
    alt: "Man wearing tailored dark trousers in an urban setting",
    description: "Precisely cut wool trousers with a clean tapered leg.",
    sizes: ["30", "32", "34", "36", "38"],
    colors: ["Charcoal", "Black", "Navy"],
    featured: false,
    newArrival: false,
  },
  {
    id: 9,
    name: "Minimal Leather Sneaker",
    category: "Shoes",
    gender: "Unisex",
    price: 92000,
    image:
      "https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=800&q=85",
    alt: "Minimalist cream leather sneaker",
    description: "A low-profile leather sneaker built for everyday movement.",
    sizes: ["39", "40", "41", "42", "43", "44"],
    colors: ["Cream", "White", "Black"],
    featured: false,
    newArrival: true,
  },
  {
    id: 10,
    name: "Classic Leather Loafers",
    category: "Shoes",
    gender: "Men",
    price: 145000,
    image:
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&w=800&q=85",
    alt: "Polished black leather loafers",
    description: "Polished leather loafers with a timeless refined profile.",
    sizes: ["39", "40", "41", "42", "43", "44"],
    colors: ["Black", "Brown"],
    featured: true,
    newArrival: false,
  },
  {
    id: 11,
    name: "Sculpted Block Heels",
    category: "Shoes",
    gender: "Women",
    price: 118000,
    image:
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=85",
    alt: "Sculpted black block heel shoes",
    description: "Modern block heels balancing confident style and comfort.",
    sizes: ["36", "37", "38", "39", "40"],
    colors: ["Black", "Tan", "Ivory"],
    featured: false,
    newArrival: false,
  },
  {
    id: 12,
    name: "Strappy Leather Sandals",
    category: "Shoes",
    gender: "Women",
    price: 72000,
    image:
      "https://images.unsplash.com/photo-1603487742131-4160ec999306?auto=format&fit=crop&w=800&q=85",
    alt: "Minimal leather sandals with slender straps",
    description: "Lightweight leather sandals for warm-weather styling.",
    sizes: ["36", "37", "38", "39", "40"],
    colors: ["Tan", "Black", "Gold"],
    featured: false,
    newArrival: true,
  },
  {
    id: 13,
    name: "Structured Shoulder Bag",
    category: "Accessories",
    gender: "Women",
    price: 112000,
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85",
    alt: "Structured black leather shoulder bag",
    description: "A structured leather bag with room for daily essentials.",
    sizes: ["One Size"],
    colors: ["Black", "Cognac"],
    featured: true,
    newArrival: false,
  },
  {
    id: 14,
    name: "Heritage Gold Watch",
    category: "Accessories",
    gender: "Unisex",
    price: 185000,
    image:
      "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=800&q=85",
    alt: "Minimal gold-tone wristwatch with a dark face",
    description: "A gold-tone watch with a minimal face and classic finish.",
    sizes: ["One Size"],
    colors: ["Gold", "Black"],
    featured: true,
    newArrival: false,
  },
  {
    id: 15,
    name: "Everyday Crossbody Bag",
    category: "Accessories",
    gender: "Women",
    price: 76000,
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85",
    alt: "Everyday tan leather crossbody bag",
    description: "A compact crossbody bag designed for hands-free days.",
    sizes: ["One Size"],
    colors: ["Tan", "Black", "Cream"],
    featured: false,
    newArrival: true,
  },
  {
    id: 16,
    name: "Frame Shield Sunglasses",
    category: "Accessories",
    gender: "Unisex",
    price: 58000,
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=85",
    alt: "Black frame sunglasses with a sleek modern shape",
    description: "Sleek sunglasses with a confident frame and UV protection.",
    sizes: ["One Size"],
    colors: ["Black", "Tortoiseshell"],
    featured: false,
    newArrival: true,
  },
];

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
        return {
          key: item.key || getCartItemKey(product.id, item.size, item.color),
          productId: product.id,
          size: String(item.size),
          color: String(item.color),
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

function getCartSubtotal() {
  return cart.reduce((subtotal, item) => {
    const product = getCartProduct(item);
    return subtotal + (product ? product.price * item.quantity : 0);
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

function addToCart(productId, size, color, quantity) {
  const product = products.find(
    (entry) => String(entry.id) === String(productId),
  );
  if (!product || !size || !color) {
    return;
  }

  const key = getCartItemKey(product.id, size, color);
  const existingItem = cart.find((item) => item.key === key);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ key, productId: product.id, size, color, quantity });
  }
  saveCart();
  updateCartViews();
}

function updateCartItemQuantity(key, quantity) {
  const item = cart.find((entry) => entry.key === key);
  if (!item) {
    return;
  }
  item.quantity = Math.max(1, quantity);
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
  return nairaFormatter.format(price);
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
  if (!product) {
    return "";
  }

  const lineTotal = product.price * item.quantity;
  const pageClass = context === "page" ? " cart-item--page" : "";
  return `
    <article class="cart-item${pageClass}" data-cart-item-key="${escapeHtml(item.key)}">
      <img class="cart-item__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
      <div class="cart-item__details">
        <p class="cart-item__category">${escapeHtml(product.category)}</p>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="cart-item__variant">Size: ${escapeHtml(item.size)} &middot; Color: ${escapeHtml(item.color)}</p>
        <div class="cart-item__meta">
          <span>Unit price: ${formatPrice(product.price)}</span>
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
            return product
              ? `<article class="checkout-summary__item">
                <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
                <div><h3>${escapeHtml(product.name)}</h3><p>Size: ${escapeHtml(item.size)} · Color: ${escapeHtml(item.color)}</p><p>Qty: ${item.quantity} · ${formatPrice(product.price)}</p></div>
                <strong>${formatPrice(product.price * item.quantity)}</strong>
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
        return product
          ? {
              productId: product.id,
              name: product.name,
              price: product.price,
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
      productId: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    })),
    customer: { ...checkoutData.customer },
    shipping: { ...checkoutData.shipping },
  };
}

function renderReviewPage() {
  pendingOrder = buildPendingOrder();
  checkoutContent.innerHTML = `
    <div class="checkout-page__header">
      <button class="checkout-page__return" type="button" data-review-action="edit">&larr; EDIT INFORMATION</button>
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
        <button class="button button-primary" type="button" data-review-action="payment">CONTINUE TO PAYMENT</button>
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

function renderOptionButtons(options, optionType) {
  return options
    .map(
      (option, index) => `
        <button
          class="product-modal__option${options.length === 1 && index === 0 ? " is-selected" : ""}"
          type="button"
          data-option-type="${optionType}"
          aria-pressed="${options.length === 1 && index === 0}"
        >${escapeHtml(option)}</button>`,
    )
    .join("");
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
  productModalContent.innerHTML = `
    <div class="product-modal__layout">
      <div class="product-modal__image-wrap">
        <img class="product-modal__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
      </div>
      <div class="product-modal__details">
        <p class="product-modal__category">${escapeHtml(product.category)} / ${escapeHtml(product.gender)}</p>
        <h2 id="product-modal-title">${escapeHtml(product.name)}</h2>
        <p class="product-modal__price">${formatPrice(product.price)}</p>
        <p class="product-modal__description">${escapeHtml(product.description)}</p>
        <div class="product-modal__field">
          <h3>SIZE</h3>
          <div class="product-modal__options" role="group" aria-label="Select size">
            ${renderOptionButtons(product.sizes, "size")}
          </div>
        </div>
        <div class="product-modal__field">
          <h3>COLOR</h3>
          <div class="product-modal__options" role="group" aria-label="Select color">
            ${renderOptionButtons(product.colors, "color")}
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
        <button class="button button-primary product-modal__add" type="button" data-add-to-cart>
          ADD TO CART
        </button>
        <p class="product-modal__status" role="status" aria-live="polite"></p>
      </div>
    </div>`;

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
    optionGroup.querySelectorAll("[data-option-type]").forEach((button) => {
      const isSelected = button === optionButton;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
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
      Math.max(1, currentQuantity + direction),
    );
    return;
  }

  if (event.target.closest("[data-add-to-cart]")) {
    const selectedSize = productModalContent.querySelector(
      '[data-option-type="size"].is-selected',
    );
    const selectedColor = productModalContent.querySelector(
      '[data-option-type="color"].is-selected',
    );
    const quantity = Number(
      productModalContent.querySelector("[data-quantity-value]").textContent,
    );
    const status = productModalContent.querySelector(".product-modal__status");

    if (!selectedSize || !selectedColor) {
      status.textContent = "Please select a size and color.";
      return;
    }

    addToCart(
      productModalContent.dataset.productId,
      selectedSize.textContent,
      selectedColor.textContent,
      quantity,
    );
    status.textContent = "Added to your shopping bag.";
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

  const reviewAction = event.target.closest("[data-review-action]");
  if (reviewAction) {
    if (reviewAction.dataset.reviewAction === "edit") {
      isEditingCheckout = true;
      renderCheckoutPage();
    } else if (reviewAction.dataset.reviewAction === "payment") {
      const reviewStatus = document.querySelector("#review-summary-status");
      if (!cart.length || !checkoutData || !pendingOrder) {
        reviewStatus.textContent =
          "Please complete checkout information before continuing.";
        return;
      }
      preparedOrderPayload = buildOrderPayload();
      // No request is sent yet. Backend order creation and payment initialization
      // will be connected after server-side validation is implemented.
      reviewStatus.textContent =
        "READY FOR PAYMENT. Your order information has been reviewed successfully. Backend payment initialization will be connected in the next stage.";
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
loadWishlist();
loadCart();
updateWishlistCount();
const featuredProducts = products.filter(
  (product) => product.featured === true,
);
const newArrivalProducts = products.filter(
  (product) => product.newArrival === true,
);

renderProducts(featuredProducts, featuredProductsGrid);
renderProducts(newArrivalProducts, newArrivalsGrid);
updateShopProducts();
renderWishlist();
updateWishlistButtons();
updateCartViews();
