export type CatalogItem = {
  icon: string
  name: string
  price: number
  store: string
  tags: string[]
}

export const CATALOG: CatalogItem[] = [
  { icon: '🎧', name: 'Echo Buds 2nd Gen', price: 39, store: 'Amazon', tags: ['headphones', 'earbuds', 'audio'] },
  { icon: '🎧', name: 'onn. Wireless Headphones', price: 24, store: 'Walmart', tags: ['headphones', 'audio'] },
  { icon: '🎧', name: 'heyday Bluetooth Earbuds', price: 29, store: 'Target', tags: ['headphones', 'earbuds', 'audio'] },
  { icon: '🎧', name: 'Sony WH-CH520', price: 59, store: 'Best Buy', tags: ['headphones', 'audio', 'music'] },
  { icon: '🎧', name: 'Summit Studio Headphones', price: 159, store: 'Amazon', tags: ['headphones', 'audio', 'music'] },
  { icon: '⌚', name: 'Fossil Minimalist Watch', price: 95, store: 'Amazon', tags: ['watch', 'jewelry', 'accessory'] },
  { icon: '⌚', name: 'Time and Tru Dress Watch', price: 22, store: 'Walmart', tags: ['watch', 'accessory'] },
  { icon: '⌚', name: 'Wild Fable Woven Watch', price: 18, store: 'Target', tags: ['watch', 'accessory'] },
  { icon: '⌚', name: 'Engraved Steel Watch', price: 68, store: 'Etsy', tags: ['watch', 'jewelry', 'personalized'] },
  { icon: '🕯️', name: 'Amber & Oak Candle Set', price: 28, store: 'Etsy', tags: ['candle', 'home', 'cozy'] },
  { icon: '🕯️', name: 'Threshold Soy Candle 3-Pack', price: 15, store: 'Target', tags: ['candle', 'home'] },
  { icon: '🕯️', name: 'Better Homes Candle Jar', price: 9, store: 'Walmart', tags: ['candle', 'home'] },
  { icon: '🕯️', name: 'Yankee Candle Gift Set', price: 32, store: 'Amazon', tags: ['candle', 'home', 'cozy'] },
  { icon: '📖', name: 'Leather Travel Journal', price: 22, store: 'Etsy', tags: ['book', 'journal', 'writing'] },
  { icon: '📖', name: 'Moleskine Classic Notebook', price: 19, store: 'Amazon', tags: ['book', 'journal', 'writing'] },
  { icon: '📖', name: 'Sun Squad Sketch Journal', price: 8, store: 'Target', tags: ['book', 'journal'] },
  { icon: '🪴', name: 'Potted Fiddle Leaf Fig', price: 34, store: 'Etsy', tags: ['plant', 'home', 'green'] },
  { icon: '🪴', name: 'Costa Farms Snake Plant', price: 19, store: 'Walmart', tags: ['plant', 'home', 'green'] },
  { icon: '🪴', name: 'Succulent Trio, Ceramic Pots', price: 26, store: 'Target', tags: ['plant', 'home', 'green'] },
  { icon: '🔊', name: 'Roam Bluetooth Speaker', price: 65, store: 'Amazon', tags: ['speaker', 'audio', 'music'] },
  { icon: '🔊', name: 'JBL Clip 4 Speaker', price: 49, store: 'Best Buy', tags: ['speaker', 'audio', 'music'] },
  { icon: '🔊', name: 'onn. Portable Speaker', price: 20, store: 'Walmart', tags: ['speaker', 'audio'] },
  { icon: '🧣', name: 'Woven Wool Scarf', price: 31, store: 'Etsy', tags: ['scarf', 'clothing', 'warm'] },
  { icon: '🧣', name: 'A New Day Knit Scarf', price: 15, store: 'Target', tags: ['scarf', 'clothing', 'warm'] },
  { icon: '🧣', name: 'Time and Tru Plaid Scarf', price: 12, store: 'Walmart', tags: ['scarf', 'clothing', 'warm'] },
  { icon: '🍫', name: 'Artisan Chocolate Box', price: 18, store: 'Etsy', tags: ['chocolate', 'sweet', 'food'] },
  { icon: '🍫', name: 'Ghirardelli Gift Tin', price: 14, store: 'Walmart', tags: ['chocolate', 'sweet', 'food'] },
  { icon: '🍫', name: 'Godiva Assorted Box', price: 25, store: 'Target', tags: ['chocolate', 'sweet', 'food'] },
  { icon: '☕', name: 'Nomad Ceramic Mug Set', price: 24, store: 'Etsy', tags: ['mug', 'coffee', 'home'] },
  { icon: '☕', name: 'Threshold Stoneware Mug', price: 7, store: 'Target', tags: ['mug', 'coffee', 'home'] },
  { icon: '☕', name: 'Better Homes Mug 2-Pack', price: 10, store: 'Walmart', tags: ['mug', 'coffee', 'home'] },
  { icon: '🧴', name: 'Calm Aromatherapy Set', price: 42, store: 'Etsy', tags: ['candle', 'spa', 'relax'] },
  { icon: '🧴', name: 'Bath & Body Gift Set', price: 22, store: 'Target', tags: ['spa', 'relax'] },
  { icon: '🧴', name: 'Equate Spa Gift Basket', price: 16, store: 'Walmart', tags: ['spa', 'relax'] },
]

export const STORE_COLORS: Record<string, string> = {
  Amazon: '#FF9900',
  Walmart: '#0071CE',
  Target: '#CC0000',
  'Best Buy': '#0A4FA0',
  Etsy: '#F1641E',
}

export function searchCatalog(query: string, budget: number | null): CatalogItem[] {
  const q = query.trim().toLowerCase()

  let results = CATALOG.filter((item) => {
    const matchesQuery = !q || item.tags.some((t) => t.includes(q)) || item.name.toLowerCase().includes(q)
    const matchesBudget = budget === null || item.price <= budget
    return matchesQuery && matchesBudget
  })

  if (q && results.length === 0 && budget !== null) {
    results = CATALOG.filter((item) => item.price <= budget).slice(0, 4)
  }

  return results
}
