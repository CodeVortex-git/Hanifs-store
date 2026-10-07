const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Exact product catalog copied from script.js. Prices are source NGN values.
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
      "https://images.unsplash.com/photo-1577900232427-18219b9166a0?auto=format&fit=crop&w=800&q=85",
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

async function resetAutoincrementSequences() {
  await prisma.$queryRaw`SELECT setval(pg_get_serial_sequence('public."Product"', 'id'), COALESCE((SELECT MAX(id) FROM "Product"), 0), true)`;
  await prisma.$queryRaw`SELECT setval(pg_get_serial_sequence('public."ProductVariant"', 'id'), COALESCE((SELECT MAX(id) FROM "ProductVariant"), 0), true)`;
}

async function seedDatabase() {
  let totalVariants = 0;

  // Idempotent upserts preserve historical order records on repeat runs.
  for (const productData of products) {
    const priceInKobo = productData.price * 100;
    const productFields = {
      name: productData.name,
      category: productData.category,
      gender: productData.gender,
      basePrice: priceInKobo,
      imageUrl: productData.image,
      imageAlt: productData.alt,
      description: productData.description,
      featured: productData.featured,
      newArrival: productData.newArrival,
      active: true,
    };
    const product = await prisma.product.upsert({
      where: { id: productData.id },
      create: { id: productData.id, ...productFields },
      update: productFields,
    });

    const variants = productData.sizes.flatMap((size) =>
      productData.colors.map((color) => ({
        productId: product.id,
        size,
        color,
        price: priceInKobo,
        stock: 10,
        active: true,
      })),
    );

    for (const variant of variants) {
      await prisma.productVariant.upsert({
        where: {
          productId_size_color: {
            productId: variant.productId,
            size: variant.size,
            color: variant.color,
          },
        },
        create: variant,
        // Re-running the catalog seed must not overwrite live inventory. Stock
        // is initialized only when a variant is first inserted.
        update: { price: variant.price, active: true },
      });
    }
    totalVariants += variants.length;
  }

  // Preserve explicit Product IDs and prevent future autoincrement collisions.
  await resetAutoincrementSequences();
  console.log(`Seeded ${products.length} products and ${totalVariants} variants.`);
}

if (require.main === module) {
  seedDatabase()
    .catch(async (error) => {
      console.error('Error seeding database:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedDatabase };
