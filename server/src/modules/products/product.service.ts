import { query } from '../../config/db.js';

export interface CreateProductDTO {
  sku: string;
  name: string;
  category: string;
  distributorPrice: number;
  mrp: number;
  volumeBv: number;
  stockQuantity: number;
  status?: string;
  imageUrl?: string;
  sizeSpec?: string;
  shortDesc?: string;
  benefits?: string[];
  usageInstructions?: string;
}

export class ProductService {
  private static demoProducts = [
    {
      id: 'prod-001',
      sku: 'KASH-HOZ-001',
      name: "Men's Premium Combed Cotton Polo",
      category: 'Clothes & Hosiery (Hozri)',
      distributorPrice: 1299.00,
      mrp: 1899.00,
      volumeBv: 25.00,
      stockQuantity: 150,
      status: 'In Stock',
      imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&auto=format&fit=crop&q=60',
      sizeSpec: 'Size: M / L / XL / XXL (Pack of 2)',
      shortDesc: 'Breathable 100% combed biowash cotton polo t-shirt with reinforced collar and anti-pilling fabric.',
      benefits: ['Pre-shrunk 100% fine cotton yarn', 'Fade-resistant eco reactive dyes', 'Tailored comfortable fit']
    },
    {
      id: 'prod-002',
      sku: 'KASH-HOZ-002',
      name: 'Thermal Active Winter Fleece Sweatshirt',
      category: 'Clothes & Hosiery (Hozri)',
      distributorPrice: 1899.00,
      mrp: 2699.00,
      volumeBv: 35.00,
      stockQuantity: 85,
      status: 'In Stock',
      imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=60',
      sizeSpec: 'Size: S / M / L / XL / XXL',
      shortDesc: 'Heavyweight brushed fleece thermal inner lining designed for superior heat retention.',
      benefits: ['High thermal insulation index', 'Ultra-soft interior brushed fleece', 'Ribbed cuffs & hem']
    },
    {
      id: 'prod-003',
      sku: 'KASH-ELE-001',
      name: 'Kashvi Ultra 4K Smart UHD Television 55"',
      category: 'Electronics & Smart Devices',
      distributorPrice: 34999.00,
      mrp: 49999.00,
      volumeBv: 450.00,
      stockQuantity: 40,
      status: 'In Stock',
      imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=60',
      sizeSpec: 'Display: 55-inch Frameless Bezel-less Panel',
      shortDesc: 'HDR10+ Quantum Color Smart TV with built-in voice remote, Dolby Atmos audio, and Android TV OS.',
      benefits: ['4K Crystal display with MEMC technology', 'Dolby Atmos surround sound system', 'Dual-band Wi-Fi & Bluetooth 5.2']
    },
    {
      id: 'prod-004',
      sku: 'KASH-ELE-002',
      name: 'Kashvi AeroSound Active Noise Cancelling Earbuds',
      category: 'Electronics & Smart Devices',
      distributorPrice: 2499.00,
      mrp: 4999.00,
      volumeBv: 50.00,
      stockQuantity: 120,
      status: 'In Stock',
      imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=60',
      sizeSpec: 'Driver: 13mm Titanium Composite Diaphragm',
      shortDesc: 'Hybrid 35dB Active Noise Cancellation with transparency pass-through mode and 36-hour playback.',
      benefits: ['Hybrid 35dB Active Noise Cancellation', '36 hours total battery with fast-charging case', 'IPX5 water & sweat resistance']
    },
    {
      id: 'prod-005',
      sku: 'KASH-ELE-003',
      name: 'Kashvi RapidAir Digital Air Fryer 4.5L',
      category: 'Electronics & Smart Devices',
      distributorPrice: 4299.00,
      mrp: 6999.00,
      volumeBv: 85.00,
      stockQuantity: 65,
      status: 'In Stock',
      imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&auto=format&fit=crop&q=60',
      sizeSpec: 'Capacity: 4.5 Litres / 1400W Rapid Vortex',
      shortDesc: 'Healthy oil-free rapid 360-degree air circulation frying system with 8 digital one-touch presets.',
      benefits: ['Up to 90% less oil consumption', 'Dishwasher-safe non-stick food basket', 'Touch digital LED temperature interface']
    }
  ];

  static async getAll(category?: string, search?: string) {
    try {
      let sql = `SELECT * FROM products WHERE is_active = TRUE`;
      const params: any[] = [];

      if (category && category !== 'All Categories') {
        params.push(category);
        sql += ` AND category = $${params.length}`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(sku) LIKE $${params.length} OR LOWER(category) LIKE $${params.length})`;
      }

      sql += ` ORDER BY created_at ASC`;
      const res = await query(sql, params);
      if (res && res.rows.length > 0) {
        return res.rows;
      }
    } catch (e) {
      // Fallback to demo products
    }

    let list = [...this.demoProducts];
    if (category && category !== 'All Categories') {
      list = list.filter(p => p.category === category);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return list;
  }

  static async getById(id: string) {
    try {
      const res = await query(`SELECT * FROM products WHERE id = $1 OR sku = $1`, [id]);
      if (res && res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (e) {
      // Fallback
    }

    const item = this.demoProducts.find(p => p.id === id || p.sku === id);
    if (!item) {
      throw new Error(`Product ${id} not found.`);
    }
    return item;
  }

  static async create(dto: CreateProductDTO) {
    try {
      const res = await query(
        `INSERT INTO products (
          sku, name, category, distributor_price, mrp, volume_bv,
          stock_quantity, status, image_url, size_spec, short_desc,
          benefits, usage_instructions
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          dto.sku,
          dto.name,
          dto.category,
          dto.distributorPrice || 0,
          dto.mrp || 0,
          dto.volumeBv || 0,
          dto.stockQuantity || 0,
          dto.status || 'In Stock',
          dto.imageUrl,
          dto.sizeSpec,
          dto.shortDesc,
          JSON.stringify(dto.benefits || []),
          dto.usageInstructions,
        ]
      );
      if (res && res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (e) {
      // Fallback
    }

    const newProd = {
      id: `prod-${Date.now()}`,
      sku: dto.sku,
      name: dto.name,
      category: dto.category,
      distributorPrice: dto.distributorPrice || 0,
      mrp: dto.mrp || 0,
      volumeBv: dto.volumeBv || 0,
      stockQuantity: dto.stockQuantity || 0,
      status: dto.status || 'In Stock',
      imageUrl: dto.imageUrl || '',
      sizeSpec: dto.sizeSpec || '',
      shortDesc: dto.shortDesc || '',
      benefits: dto.benefits || []
    };
    this.demoProducts.push(newProd);
    return newProd;
  }

  static async updatePricingAndDetails(id: string, data: Partial<CreateProductDTO>) {
    try {
      const res = await query(
        `UPDATE products
         SET distributor_price = COALESCE($1, distributor_price),
             mrp = COALESCE($2, mrp),
             volume_bv = COALESCE($3, volume_bv),
             stock_quantity = COALESCE($4, stock_quantity),
             status = COALESCE($5, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 OR sku = $6
         RETURNING *`,
        [data.distributorPrice, data.mrp, data.volumeBv, data.stockQuantity, data.status, id]
      );
      if (res && res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (e) {
      // Fallback
    }

    const item = this.demoProducts.find(p => p.id === id || p.sku === id);
    if (item) {
      if (data.distributorPrice !== undefined) item.distributorPrice = data.distributorPrice;
      if (data.mrp !== undefined) item.mrp = data.mrp;
      if (data.volumeBv !== undefined) item.volumeBv = data.volumeBv;
      if (data.stockQuantity !== undefined) item.stockQuantity = data.stockQuantity;
      if (data.status !== undefined) item.status = data.status;
      return item;
    }
    throw new Error(`Product ${id} not found.`);
  }

  static async deleteProduct(id: string) {
    try {
      await query(`DELETE FROM products WHERE id = $1 OR sku = $1`, [id]);
    } catch (e) {
      // Fallback
    }
    const idx = this.demoProducts.findIndex(p => p.id === id || p.sku === id);
    if (idx !== -1) {
      this.demoProducts.splice(idx, 1);
    }
    return { success: true, deletedId: id };
  }

  static async bulkDelete(ids: string[]) {
    try {
      await query(`DELETE FROM products WHERE id = ANY($1::uuid[]) OR sku = ANY($1::text[])`, [ids]);
    } catch (e) {
      // Fallback
    }
    this.demoProducts = this.demoProducts.filter(p => !ids.includes(p.id) && !ids.includes(p.sku));
    return { success: true, deletedCount: ids.length };
  }

  static async resetZero() {
    try {
      await query(`DELETE FROM products`);
    } catch (e) {
      // Fallback
    }
    this.demoProducts = [];
    return { success: true, message: 'All catalog data reset to 0.' };
  }

  static async loadPlaceholders() {
    this.demoProducts = [
      {
        id: 'KASH-HOZ-001',
        sku: 'KASH-HOZ-001',
        name: "Men's Combed Cotton Hosiery T-Shirt",
        category: 'Clothes & Hosiery (Hozri)',
        distributorPrice: 0,
        mrp: 0,
        volumeBv: 0,
        stockQuantity: 0,
        status: 'Pending Pricing',
        imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600',
        sizeSpec: 'Size: M / L / XL / XXL',
        shortDesc: '100% Super-combed breathable cotton hosiery fabric with soft ribbed collar.',
        benefits: ['Breathable comfort', 'Bio-washed anti-shrink finish', 'Zero-friction seams']
      },
      {
        id: 'KASH-HOZ-002',
        sku: 'KASH-HOZ-002',
        name: 'Hosiery Comfort Innerwear / Vest (Pack of 2)',
        category: 'Clothes & Hosiery (Hozri)',
        distributorPrice: 0,
        mrp: 0,
        volumeBv: 0,
        stockQuantity: 0,
        status: 'Pending Pricing',
        imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600',
        sizeSpec: 'Pack of 2 / Stretch Fit',
        shortDesc: 'Ultra-soft stretchable micro-modal hosiery innerwear.',
        benefits: ['Moisture wicking sweat barrier', 'Contoured body-hugging flexible fit']
      },
      {
        id: 'KASH-HOZ-003',
        sku: 'KASH-HOZ-003',
        name: 'Anti-Bacterial Bamboo Hosiery Socks (Pack of 3)',
        category: 'Clothes & Hosiery (Hozri)',
        distributorPrice: 0,
        mrp: 0,
        volumeBv: 0,
        stockQuantity: 0,
        status: 'Pending Pricing',
        imageUrl: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=600',
        sizeSpec: 'Pack of 3 Pairs',
        shortDesc: 'Naturally anti-microbial bamboo-cotton blended hosiery socks.',
        benefits: ['Natural anti-odor shield', 'Soft terry sole cushioning']
      },
      {
        id: 'KASH-HOZ-004',
        sku: 'KASH-HOZ-004',
        name: 'Winter Fleeced Hosiery Hoodie & Sweatshirt',
        category: 'Clothes & Hosiery (Hozri)',
        distributorPrice: 0,
        mrp: 0,
        volumeBv: 0,
        stockQuantity: 0,
        status: 'Pending Pricing',
        imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600',
        sizeSpec: 'Unisex Fit / Full Sleeves',
        shortDesc: 'Heavy-weight brushed cotton fleece hosiery hoodie.',
        benefits: ['Thermal heat retention brushed inner lining', 'Double-layered hood']
      },
      {
        id: 'KASH-ELE-001',
        sku: 'KASH-ELE-001',
        name: 'Smart Active Wireless Noise-Cancelling Headphones',
        category: 'Electronics & Smart Devices',
        distributorPrice: 0,
        mrp: 0,
        volumeBv: 0,
        stockQuantity: 0,
        status: 'Pending Pricing',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
        sizeSpec: 'Headphones + Type-C Cable + Travel Pouch',
        shortDesc: 'High-fidelity active noise-cancelling Bluetooth 5.3 headphones.',
        benefits: ['Up to 40 hours total wireless playback', 'Hybrid ANC']
      },
      {
        id: 'KASH-ELE-002',
        sku: 'KASH-ELE-002',
        name: 'Smart Multi-Cook Digital Home Appliance',
        category: 'Electronics & Smart Devices',
        distributorPrice: 0,
        mrp: 0,
        volumeBv: 0,
        stockQuantity: 0,
        status: 'Pending Pricing',
        imageUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600',
        sizeSpec: '3.5L Cooking Capacity / 1200W',
        shortDesc: 'Energy-efficient digital kitchen appliance with one-touch presets.',
        benefits: ['360-degree rapid heating', 'Non-stick food grade inner pot']
      },
      {
        id: 'KASH-ELE-003',
        sku: 'KASH-ELE-003',
        name: 'Ultra-Slim Pro Productivity Laptop',
        category: 'Electronics & Smart Devices',
        distributorPrice: 0,
        mrp: 0,
        volumeBv: 0,
        stockQuantity: 0,
        status: 'Pending Pricing',
        imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600',
        sizeSpec: '15.6" FHD IPS / 16GB RAM / 512GB NVMe',
        shortDesc: 'Lightweight brushed aluminum chassis with 11-hour all-day battery.',
        benefits: ['Anti-glare IPS display', 'Backlit keyboard with biometric fingerprint']
      },
      {
        id: 'KASH-ELE-004',
        sku: 'KASH-ELE-004',
        name: 'Pro 5G Dual-SIM Smartphone & Mobile Device',
        category: 'Electronics & Smart Devices',
        distributorPrice: 0,
        mrp: 0,
        volumeBv: 0,
        stockQuantity: 0,
        status: 'Pending Pricing',
        imageUrl: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600',
        sizeSpec: '6.67" 120Hz AMOLED / 8GB RAM / 256GB',
        shortDesc: 'Flagship 5G dual-SIM smartphone with 50MP AI triple camera system.',
        benefits: ['120Hz Super AMOLED Display', '67W Turbo Fast Charge']
      }
    ];
    return { success: true, count: this.demoProducts.length, data: this.demoProducts };
  }
}
