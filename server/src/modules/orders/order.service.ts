import { query } from '../../config/db.js';

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface PlaceOrderDTO {
  distributorMemberId: string;
  items: OrderItemInput[];
  shippingAddress: string;
  paymentMethod?: string;
}

export class OrderService {
  static async placeOrder(dto: PlaceOrderDTO) {
    if (!dto.items || dto.items.length === 0) {
      throw new Error('Order must contain at least one item.');
    }

    // 1. Fetch Distributor
    const distRes = await query('SELECT id, member_id, current_psv FROM distributors WHERE member_id = $1', [
      dto.distributorMemberId,
    ]);
    if (distRes.rows.length === 0) {
      throw new Error(`Distributor ${dto.distributorMemberId} not found.`);
    }
    const dist = distRes.rows[0];

    // 2. Fetch products and calculate totals
    let totalAmount = 0;
    let totalBv = 0;
    let totalMrp = 0;
    const resolvedItems: any[] = [];

    for (const it of dto.items) {
      const pRes = await query('SELECT * FROM products WHERE id = $1 OR sku = $1', [it.productId]);
      if (pRes.rows.length === 0) {
        throw new Error(`Product ${it.productId} not found.`);
      }
      const prod = pRes.rows[0];
      const qty = it.quantity || 1;
      const itemPrice = parseFloat(prod.distributor_price) * qty;
      const itemBv = parseFloat(prod.volume_bv) * qty;
      const itemMrp = parseFloat(prod.mrp) * qty;

      totalAmount += itemPrice;
      totalBv += itemBv;
      totalMrp += itemMrp;

      resolvedItems.push({
        product: prod,
        quantity: qty,
        unitDistributorPrice: prod.distributor_price,
        unitMrp: prod.mrp,
        unitBv: prod.volume_bv,
        totalPrice: itemPrice,
        totalBv: itemBv,
      });
    }

    const savingsAmount = Math.max(0, totalMrp - totalAmount);
    const orderNumber = `KASH-ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    // 3. Insert Order
    const orderRes = await query(
      `INSERT INTO orders (
        order_number, distributor_id, total_amount, total_bv, total_mrp,
        savings_amount, payment_method, payment_status, order_status, shipping_address
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Paid', 'Processing', $8)
       RETURNING *`,
      [
        orderNumber,
        dist.id,
        totalAmount,
        totalBv,
        totalMrp,
        savingsAmount,
        dto.paymentMethod || 'Online Payment',
        dto.shippingAddress,
      ]
    );

    const order = orderRes.rows[0];

    // 4. Insert Order Items
    for (const line of resolvedItems) {
      await query(
        `INSERT INTO order_items (
          order_id, product_id, quantity, unit_distributor_price,
          unit_mrp, unit_bv, total_price, total_bv
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          line.product.id,
          line.quantity,
          line.unitDistributorPrice,
          line.unitMrp,
          line.unitBv,
          line.totalPrice,
          line.totalBv,
        ]
      );
    }

    // 5. Attribute Personal Volume Points (PSV) to distributor
    await query(
      `UPDATE distributors
       SET current_psv = current_psv + $1,
           lifetime_bv = lifetime_bv + $1,
           qualification_status = CASE WHEN (current_psv + $1) >= 100 THEN 'Active' ELSE qualification_status END
       WHERE id = $2`,
      [totalBv, dist.id]
    );

    // 6. Record in BV Ledger
    await query(
      `INSERT INTO bv_ledger (
        distributor_id, source_order_id, transaction_type, leg_affected,
        amount_bv, cycle_week, cycle_year, description
       ) VALUES ($1, $2, 'Personal_Order', 'personal', $3, 38, 2026, $4)`,
      [dist.id, order.id, totalBv, `Wholesale order ${orderNumber} - +${totalBv} BV credited`]
    );

    return {
      orderNumber: order.order_number,
      totalAmount: order.total_amount,
      totalBv: order.total_bv,
      totalMrp: order.total_mrp,
      savings: order.savings_amount,
      status: order.order_status,
      deliveryEta: order.delivery_eta,
      items: resolvedItems.map((r) => ({
        name: r.product.name,
        quantity: r.quantity,
        price: r.totalPrice,
        bv: r.totalBv,
      })),
    };
  }

  static async getOrdersByDistributor(memberId: string) {
    const res = await query(
      `SELECT o.*, d.member_id, d.full_name
       FROM orders o
       JOIN distributors d ON d.id = o.distributor_id
       WHERE d.member_id = $1
       ORDER BY o.placed_at DESC`,
      [memberId]
    );
    return res.rows;
  }

  static async getOrderDetails(orderNumber: string) {
    const orderRes = await query('SELECT * FROM orders WHERE order_number = $1 OR id::text = $1', [orderNumber]);
    if (orderRes.rows.length === 0) {
      throw new Error(`Order ${orderNumber} not found.`);
    }
    const order = orderRes.rows[0];

    const itemsRes = await query(
      `SELECT oi.*, p.name, p.sku, p.category, p.image_url
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    return {
      ...order,
      items: itemsRes.rows,
    };
  }
}
