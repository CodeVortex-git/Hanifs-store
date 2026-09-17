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

// DOM elements
const featuredProductsGrid = document.querySelector("#featured-products-grid");
const newArrivalsGrid = document.querySelector("#new-arrivals-grid");

// Product rendering
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
  const categoryLabel = escapeHtml(`${product.gender} ${product.category}`);
  const badge = product.newArrival
    ? '<span class="product-card__badge">NEW</span>'
    : "";

  return `
    <article class="product-card">
      <a class="product-card__link" href="#product-${escapeHtml(product.id)}">
        <div class="product-card__image">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}">
          ${badge}
        </div>
        <div class="product-card__details">
          <p class="product-card__category">${categoryLabel}</p>
          <h3>${productName}</h3>
          <p class="price">${formatPrice(product.price)}</p>
        </div>
      </a>
      <button class="product-card__wishlist" type="button" aria-label="Add ${productName} to wishlist">
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M20.84 8.61a5.5 5.5 0 0 0-7.78-7.78L12 1.89l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 17.48Z"></path>
        </svg>
      </button>
    </article>`;
}

function renderProducts(productList, container) {
  if (!container) {
    return;
  }

  container.innerHTML = productList.length
    ? productList.map(renderProductCard).join("")
    : '<p class="product-grid__empty">No products available.</p>';
}

// Initialization
renderProducts(
  products.filter((product) => product.featured === true),
  featuredProductsGrid,
);
renderProducts(
  products.filter((product) => product.newArrival === true),
  newArrivalsGrid,
);
