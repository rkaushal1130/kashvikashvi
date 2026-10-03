import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  Check,
  Plus,
  Minus,
  X,
  ArrowRight,
  ShieldCheck,
  Award,
  CreditCard,
  Printer,
} from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../../data/productCatalog';
import './ShopView.css';

/**
 * Professional KASHVIMLM Distributor Storefront & Wholesale Ordering
 * Displays real-time products, prices, and Commission Volume Points (BV).
 * Updates dynamically whenever the ID Owner adds/edits products in ProductManagerView.
 */
function ShopView({ user, catalog, onNavigate }) {
  const memberName = user?.name || 'Rahul kaushal';
  const memberId = user?.memberId || '88767139';

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured'); // 'featured' | 'price_low' | 'price_high' | 'bv_high'

  // Cart State: { [productId]: quantity }
  const [cartItems, setCartItems] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeQuickView, setActiveQuickView] = useState(null);
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  // Add to cart
  const handleAddToCart = (product, qty = 1) => {
    setCartItems((prev) => {
      const current = prev[product.id] || 0;
      return { ...prev, [product.id]: current + qty };
    });
    showToast(`Added ${qty} × ${product.name} to Cart`);
  };

  // Update cart item quantity
  const handleUpdateQty = (productId, delta) => {
    setCartItems((prev) => {
      const current = prev[productId] || 0;
      const updated = current + delta;
      if (updated <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: updated };
    });
  };

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    let list = [...catalog];

    if (selectedCategory !== 'All Categories') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.shortDesc && p.shortDesc.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'price_low') {
      list.sort((a, b) => a.distributorPrice - b.distributorPrice);
    } else if (sortBy === 'price_high') {
      list.sort((a, b) => b.distributorPrice - a.distributorPrice);
    } else if (sortBy === 'bv_high') {
      list.sort((a, b) => b.volumeBV - a.volumeBV);
    }

    return list;
  }, [catalog, selectedCategory, searchQuery, sortBy]);

  // Cart Calculations
  const cartSummary = useMemo(() => {
    let totalItems = 0;
    let totalPrice = 0;
    let totalBV = 0;
    let totalMrp = 0;

    Object.entries(cartItems).forEach(([pId, qty]) => {
      const item = catalog.find((p) => p.id === pId);
      if (item) {
        totalItems += qty;
        totalPrice += item.distributorPrice * qty;
        totalBV += item.volumeBV * qty;
        totalMrp += (item.mrp || item.distributorPrice * 1.25) * qty;
      }
    });

    const totalSavings = Math.max(0, totalMrp - totalPrice);

    return { totalItems, totalPrice, totalBV, totalMrp, totalSavings };
  }, [cartItems, catalog]);

  // Handle Checkout submission
  const handleConfirmOrder = () => {
    const orderId = `KASH-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder = {
      orderId,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      itemsCount: cartSummary.totalItems,
      totalAmount: cartSummary.totalPrice,
      creditedBV: cartSummary.totalBV,
      memberId,
      memberName,
      status: 'Paid & Processing Delivery',
      deliveryEta: '2-4 Business Days via Bluedart Express',
    };

    setOrderConfirmed(newOrder);
    setCartItems({});
    setCheckoutModal(false);
  };

  return (
    <div className="shop-page-container">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="shop-toast-banner">
          <Check size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Wholesale Header Banner */}
      <div className="shop-hero-header">
        <div className="shop-hero-left">
          <div className="distributor-pricing-badge">
            <ShieldCheck size={15} />
            <span>WHOLESALE DISTRIBUTOR STORE</span>
          </div>
          <h1 className="shop-hero-title">KASHVIMLM Official Product Store</h1>
          <p className="shop-hero-desc">
            Order premium clothes, hosiery garments, and modern electronic smart devices at
            preferential distributor wholesale pricing. All orders accumulate personal volume points
            (BV) toward your weekly commission qualification.
          </p>
        </div>

        {/* Floating Cart Launcher Button */}
        <div className="shop-hero-cart-box">
          <button
            type="button"
            className="btn-open-cart"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="cart-icon-wrapper">
              <ShoppingCart size={22} />
              {cartSummary.totalItems > 0 && (
                <span className="cart-badge-count">{cartSummary.totalItems}</span>
              )}
            </div>
            <div className="cart-box-text">
              <span className="cart-box-label">Your Order Cart</span>
              <span className="cart-box-val">₹{cartSummary.totalPrice.toLocaleString('en-IN')}</span>
            </div>
            <span className="cart-bv-bubble">+{cartSummary.totalBV} BV</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="shop-controls-bar">
        {/* Category Pills */}
        <div className="shop-category-pills">
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`cat-pill-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="shop-search-sort-row">
          <div className="shop-search-input-wrap">
            <Search size={16} className="shop-search-icon" />
            <input
              type="text"
              placeholder="Search products by name or benefit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="shop-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="shop-sort-wrap">
            <span className="sort-label">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="shop-sort-select"
            >
              <option value="featured">Featured</option>
              <option value="bv_high">Highest BV Points</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="shop-empty-catalog-box">
          <Award size={44} className="empty-shop-icon" />
          <h3>No Products in Catalog (0 Items)</h3>
          <p>
            The catalog is currently empty or no items match your selected filter. The ID Owner can load Hozri &amp; Electronic placeholders or add custom items.
          </p>
          {onNavigate && (
            <button
              type="button"
              className="btn-go-to-manager"
              onClick={() => onNavigate('manage_products')}
            >
              Open Product &amp; Price Manager
            </button>
          )}
        </div>
      ) : (
        <div className="shop-products-grid">
          {filteredProducts.map((product) => {
            const qtyInCart = cartItems[product.id] || 0;
            const discountPct =
              product.mrp > 0 && product.mrp > product.distributorPrice
                ? Math.round(((product.mrp - product.distributorPrice) / product.mrp) * 100)
                : 0;

            return (
              <div key={product.id} className="shop-product-card">
                {/* Image & Badges */}
                <div
                  className="product-image-wrap"
                  onClick={() => setActiveQuickView(product)}
                  title="Click to view full details"
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="product-main-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="product-img-placeholder">
                      <span>{product.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                  )}

                  {/* Discount Badge */}
                  {discountPct > 0 && (
                    <div className="product-discount-badge">
                      {discountPct}% OFF
                    </div>
                  )}

                  {/* Volume Points Bubble */}
                  <div className="product-bv-bubble">
                    <Award size={12} />
                    <span>{product.volumeBV} BV</span>
                  </div>
                </div>

              {/* Card Body */}
              <div className="product-card-body">
                <span className="product-cat-tag">{product.category}</span>
                <h3
                  className="product-card-title"
                  onClick={() => setActiveQuickView(product)}
                >
                  {product.name}
                </h3>
                {product.servingSize && (
                  <span className="product-serving-text">{product.servingSize}</span>
                )}

                <p className="product-short-desc">
                  {product.shortDesc || 'Premium quality apparel & electronic device manufactured for long-lasting performance.'}
                </p>

                {/* Pricing Display */}
                <div className="product-price-section">
                  <div className="price-values-wrap">
                    <span className="distributor-price">
                      ₹{product.distributorPrice.toLocaleString('en-IN')}
                    </span>
                    {product.mrp && (
                      <span className="mrp-price">
                        ₹{product.mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <span className="wholesale-tag">Wholesale Rate</span>
                </div>

                {/* Action Buttons */}
                <div className="product-card-footer">
                  {qtyInCart > 0 ? (
                    <div className="cart-stepper-btn">
                      <button
                        type="button"
                        className="stepper-sub"
                        onClick={() => handleUpdateQty(product.id, -1)}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="stepper-val">{qtyInCart} in Cart</span>
                      <button
                        type="button"
                        className="stepper-add"
                        onClick={() => handleUpdateQty(product.id, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-add-to-cart"
                      onClick={() => handleAddToCart(product, 1)}
                    >
                      <ShoppingCart size={15} />
                      <span>Add to Cart</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-quick-view"
                    onClick={() => setActiveQuickView(product)}
                    title="View Product Specs & Benefits"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* QUICK VIEW MODAL */}
      {activeQuickView && (
        <div className="shop-modal-backdrop" onClick={() => setActiveQuickView(null)}>
          <div className="quickview-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-icon-btn"
              onClick={() => setActiveQuickView(null)}
            >
              <X size={18} />
            </button>

            <div className="quickview-grid">
              <div className="quickview-img-box">
                {activeQuickView.image ? (
                  <img src={activeQuickView.image} alt={activeQuickView.name} />
                ) : (
                  <div className="img-box-placeholder">{activeQuickView.name.slice(0, 2)}</div>
                )}
                <div className="quickview-bv-pill">
                  Earns {activeQuickView.volumeBV} Commission Volume Points (BV)
                </div>
              </div>

              <div className="quickview-details-box">
                <span className="qv-category">{activeQuickView.category}</span>
                <h2 className="qv-title">{activeQuickView.name}</h2>
                <div className="qv-serving">{activeQuickView.servingSize}</div>

                <div className="qv-price-row">
                  <span className="qv-distributor-price">
                    ₹{activeQuickView.distributorPrice.toLocaleString('en-IN')}
                  </span>
                  {activeQuickView.mrp && (
                    <span className="qv-mrp">MRP ₹{activeQuickView.mrp.toLocaleString('en-IN')}</span>
                  )}
                  <span className="qv-status-pill">{activeQuickView.status || 'In Stock'}</span>
                </div>

                <p className="qv-desc">{activeQuickView.shortDesc}</p>

                {activeQuickView.benefits && (
                  <div className="qv-benefits-section">
                    <h4>Key Highlights &amp; Specifications:</h4>
                    <ul>
                      {activeQuickView.benefits.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeQuickView.usage && (
                  <div className="qv-usage-section">
                    <strong>Specifications &amp; Care:</strong> {activeQuickView.usage}
                  </div>
                )}

                <div className="qv-action-row">
                  <button
                    type="button"
                    className="btn-qv-add"
                    onClick={() => {
                      handleAddToCart(activeQuickView, 1);
                      setActiveQuickView(null);
                      setIsCartOpen(true);
                    }}
                  >
                    <ShoppingCart size={16} />
                    <span>Add to Order Cart</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOPPING CART SLIDE-IN DRAWER */}
      {isCartOpen && (
        <div className="cart-drawer-backdrop" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cart-drawer-header">
              <div className="drawer-title-wrap">
                <ShoppingCart size={20} />
                <h3>Distributor Order Cart</h3>
                <span className="drawer-count">({cartSummary.totalItems} items)</span>
              </div>
              <button
                type="button"
                className="cart-close-btn"
                onClick={() => setIsCartOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="cart-drawer-items">
              {cartSummary.totalItems === 0 ? (
                <div className="cart-empty-state">
                  <ShoppingCart size={42} className="empty-cart-icon" />
                  <h4>Your order cart is empty</h4>
                  <p>Browse our clothes, hosiery, and electronic products and add them to your cart.</p>
                </div>
              ) : (
                Object.entries(cartItems).map(([pId, qty]) => {
                  const item = catalog.find((p) => p.id === pId);
                  if (!item) return null;

                  return (
                    <div key={pId} className="cart-item-row">
                      <div className="cart-item-img-thumb">
                        {item.image ? (
                          <img src={item.image} alt={item.name} />
                        ) : (
                          <span>{item.name.slice(0, 2)}</span>
                        )}
                      </div>

                      <div className="cart-item-meta">
                        <h4 className="cart-item-title">{item.name}</h4>
                        <div className="cart-item-price-line">
                          <span>₹{item.distributorPrice} each</span>
                          <span className="meta-sep">•</span>
                          <span className="item-bv">+{item.volumeBV * qty} BV</span>
                        </div>

                        <div className="cart-item-qty-stepper">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(pId, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span>{qty}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(pId, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="cart-item-total">
                        ₹{(item.distributorPrice * qty).toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Summary & Checkout Footer */}
            {cartSummary.totalItems > 0 && (
              <div className="cart-drawer-footer">
                <div className="cart-calc-row">
                  <span>Total Volume Points:</span>
                  <strong className="text-teal font-bold">+{cartSummary.totalBV} BV Points</strong>
                </div>

                <div className="cart-calc-row">
                  <span>Distributor Savings:</span>
                  <span className="text-green font-semibold">
                    -₹{cartSummary.totalSavings.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="cart-calc-row total">
                  <span>Payable Total:</span>
                  <strong className="total-amount">
                    ₹{cartSummary.totalPrice.toLocaleString('en-IN')}
                  </strong>
                </div>

                <button
                  type="button"
                  className="btn-checkout-now"
                  onClick={() => {
                    setIsCartOpen(false);
                    setCheckoutModal(true);
                  }}
                >
                  <span>Proceed to Wholesale Checkout</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {checkoutModal && (
        <div className="shop-modal-backdrop" onClick={() => setCheckoutModal(false)}>
          <div className="checkout-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <CreditCard size={22} className="checkout-icon" />
              <div>
                <h3 className="modal-title">Distributor Wholesale Order Checkout</h3>
                <p className="modal-sub">
                  Review delivery address and select payment gateway to finalize order.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setCheckoutModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="checkout-body-grid">
              <div className="checkout-left-form">
                <h4 className="section-subtitle">1. Shipping Address</h4>
                <div className="address-box-selected">
                  <strong>{memberName}</strong> (ID: {memberId})
                  <p>Plot No. 43, Shiv TP Nagar, Baldev Nagar, Ambala City, Haryana - 134007</p>
                  <p>Phone: +91 98765 43210</p>
                </div>

                <h4 className="section-subtitle" style={{ marginTop: '16px' }}>
                  2. Payment Method
                </h4>
                <div className="payment-options-list">
                  <label className="payment-radio-row selected">
                    <input type="radio" name="payMethod" defaultChecked />
                    <div>
                      <strong>Commission Balance Wallet</strong>
                      <span>Pay directly from accumulated weekly commission balance (₹42,500 available)</span>
                    </div>
                  </label>

                  <label className="payment-radio-row">
                    <input type="radio" name="payMethod" />
                    <div>
                      <strong>UPI / Instant QR Payment</strong>
                      <span>Google Pay, PhonePe, Paytm, BHIM UPI</span>
                    </div>
                  </label>

                  <label className="payment-radio-row">
                    <input type="radio" name="payMethod" />
                    <div>
                      <strong>Debit / Credit Card / NetBanking</strong>
                      <span>All major Indian commercial banks supported</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="checkout-right-summary">
                <h4 className="section-subtitle">Order Summary</h4>
                <div className="summary-breakdown-box">
                  <div className="summary-line">
                    <span>Total Items:</span>
                    <strong>{cartSummary.totalItems} units</strong>
                  </div>
                  <div className="summary-line">
                    <span>Wholesale Subtotal:</span>
                    <span>₹{cartSummary.totalPrice.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="summary-line">
                    <span>Shipping & Handling:</span>
                    <span className="text-green font-semibold">FREE (Distributor Perk)</span>
                  </div>
                  <div className="summary-line">
                    <span>GST (18% Included):</span>
                    <span>₹{Math.round(cartSummary.totalPrice * 0.18).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="summary-line highlight-bv">
                    <span>Volume Credited:</span>
                    <strong>+{cartSummary.totalBV} BV Points</strong>
                  </div>
                  <div className="summary-line grand-total">
                    <span>Total Payable:</span>
                    <strong>₹{cartSummary.totalPrice.toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-place-order"
                  onClick={handleConfirmOrder}
                >
                  <ShieldCheck size={18} />
                  <span>Place Wholesale Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER CONFIRMATION MODAL */}
      {orderConfirmed && (
        <div className="shop-modal-backdrop" onClick={() => setOrderConfirmed(null)}>
          <div className="invoice-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-header">
              <div className="invoice-success-badge">
                <Check size={28} />
              </div>
              <h2 className="invoice-title">Order Placed Successfully!</h2>
              <p className="invoice-subtitle">
                Your wholesale order has been confirmed and submitted to the warehouse.
              </p>
            </div>

            <div className="invoice-details-card">
              <div className="inv-row">
                <span>Order Reference:</span>
                <strong>{orderConfirmed.orderId}</strong>
              </div>
              <div className="inv-row">
                <span>Order Date:</span>
                <span>{orderConfirmed.date}</span>
              </div>
              <div className="inv-row">
                <span>Buyer:</span>
                <span>{orderConfirmed.memberName} (ID: {orderConfirmed.memberId})</span>
              </div>
              <div className="inv-row">
                <span>Items Ordered:</span>
                <span>{orderConfirmed.itemsCount} products</span>
              </div>
              <div className="inv-row">
                <span>Volume Points Credited:</span>
                <strong className="text-teal font-bold">+{orderConfirmed.creditedBV} BV Points</strong>
              </div>
              <div className="inv-row">
                <span>Amount Paid:</span>
                <strong className="inv-price">₹{orderConfirmed.totalAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div className="inv-row">
                <span>Estimated Delivery:</span>
                <span>{orderConfirmed.deliveryEta}</span>
              </div>
            </div>

            <div className="invoice-actions-row">
              <button
                type="button"
                className="btn-invoice-action primary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>Print Tax Invoice</span>
              </button>
              <button
                type="button"
                className="btn-invoice-action secondary"
                onClick={() => setOrderConfirmed(null)}
              >
                <span>Continue Shopping</span>
              </button>
              <button
                type="button"
                className="btn-invoice-action outline"
                onClick={() => onNavigate('dashboard')}
              >
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShopView;
