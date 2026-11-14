import React, { useState, useMemo, useEffect } from 'react';
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
  Download,
  Loader2,
} from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../../data/productCatalog';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import './ShopView.css';

// Pricing: DP (distributor price) is GST-exclusive. Final price = DP + GST, 2 decimals.
// GST is computed per cart line (DP x qty x rate%), matching the backend order calculation.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fmtINR = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gstRateOf = (p) => Number(p?.gstRate ?? 18);
// Computed in integer paise so half-paisa values round up exactly like the backend (Decimal ROUND_HALF_UP)
const lineGst = (p, qty = 1) => {
  const linePaise = Math.round(Number(p?.distributorPrice || 0) * 100) * qty;
  return Math.round((linePaise * gstRateOf(p)) / 100) / 100;
};
const finalPriceOf = (p, qty = 1) => round2(Number(p?.distributorPrice || 0) * qty + lineGst(p, qty));

/**
 * Ensures Razorpay Checkout script is loaded dynamically in the browser
 */
const ensureRazorpayLoaded = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = typeof document !== 'undefined' && document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      setTimeout(() => resolve(Boolean(window.Razorpay)), 1500);
      return;
    }
    if (typeof document !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    } else {
      resolve(false);
    }
  });
};

/**
 * Professional KASHVIMLM Distributor Storefront & Wholesale Ordering
 * Displays real-time products, prices, and Commission Volume Points (BV).
 * Updates dynamically whenever the ID Owner adds/edits products in ProductManagerView.
 */
function ShopView({ user, catalog, onNavigate }) {
  const { canManageProducts: authCanManage } = useAuth();
  const canManageProducts = Boolean(
    authCanManage ||
    user?.isOwner === true ||
    user?.role?.toUpperCase() === 'ADMIN' ||
    user?.role?.toUpperCase() === 'SUPER_ADMIN'
  );
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

  // Shipping Address State: loaded from permanently saved address or user profile
  const [shippingAddress, setShippingAddress] = useState(() => {
    try {
      const stored = localStorage.getItem('kashvi_saved_shipping_address');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to parse saved shipping address', e);
    }
    return {
      recipientName: user?.fullName || user?.name || memberName || 'Valued Member',
      phone: user?.phone || '07719561597',
      streetAddress: user?.addresses?.[0]?.streetAddress || 'Plot No. 43, Shiv TP Nagar, Baldev Nagar',
      city: user?.addresses?.[0]?.city || 'Ambala City',
      state: user?.addresses?.[0]?.state || 'Haryana',
      postalCode: user?.addresses?.[0]?.postalCode || '134007',
      country: 'India',
    };
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [tempAddress, setTempAddress] = useState(shippingAddress);

  // Sync shipping address dynamically if updated in enrollment or other tabs
  useEffect(() => {
    const handleAddressUpdate = (e) => {
      if (e?.detail) {
        setShippingAddress(e.detail);
        setTempAddress(e.detail);
      }
    };
    window.addEventListener('kashvi_address_updated', handleAddressUpdate);
    return () => window.removeEventListener('kashvi_address_updated', handleAddressUpdate);
  }, []);

  const handleSaveAddress = (e) => {
    e.preventDefault();
    if (!tempAddress.streetAddress || !tempAddress.city || !tempAddress.postalCode) {
      alert('Please fill in Street Address, City, and Postal PIN Code.');
      return;
    }
    setShippingAddress(tempAddress);
    try {
      localStorage.setItem('kashvi_saved_shipping_address', JSON.stringify(tempAddress));
      window.dispatchEvent(new CustomEvent('kashvi_address_updated', { detail: tempAddress }));
    } catch (err) {
      console.warn('Could not save updated address to localStorage', err);
    }
    setIsEditingAddress(false);
    showToast('Delivery address updated and permanently saved!');
  };

  // Payment & Wallet States
  const [walletBalance, setWalletBalance] = useState(42500);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('WALLET'); // 'WALLET' | 'UPI' | 'CARD'
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  // Fetch live wallet balance from backend whenever checkout modal is opened
  useEffect(() => {
    if (checkoutModal) {
      setIsLoadingWallet(true);
      api
        .getWalletBalance()
        .then((data) => {
          if (data && typeof data.availableBalance === 'number') {
            setWalletBalance(data.availableBalance);
          }
        })
        .catch((err) => {
          console.warn('[ShopView] Error retrieving live wallet balance:', err);
        })
        .finally(() => {
          setIsLoadingWallet(false);
        });
    }
  }, [checkoutModal]);

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
    let totalWithoutGst = 0; // sum of DP x qty
    let totalBV = 0;
    let totalMrp = 0;
    let totalGst = 0;

    Object.entries(cartItems).forEach(([pId, qty]) => {
      const item = catalog.find((p) => p.id === pId);
      if (item) {
        totalItems += qty;
        // DP is GST-exclusive: GST is added on top of DP x qty
        totalWithoutGst += item.distributorPrice * qty;
        totalGst += lineGst(item, qty);
        totalBV += item.volumeBV * qty;
        totalMrp += (item.mrp || item.distributorPrice * 1.25) * qty;
      }
    });

    totalWithoutGst = round2(totalWithoutGst);
    totalGst = round2(totalGst);
    const totalPrice = round2(totalWithoutGst + totalGst); // Payable = DP + GST
    const totalSavings = round2(Math.max(0, totalMrp - totalPrice));

    return { totalItems, totalPrice, totalBV, totalMrp, totalSavings, totalGst, totalWithoutGst };
  }, [cartItems, catalog]);

  // Handle Checkout submission
  const handleConfirmOrder = async () => {
    if (isProcessingOrder) return;
    setIsProcessingOrder(true);

    const items = Object.entries(cartItems).map(([productId, quantity]) => {
      const prod = catalog.find((p) => p.id === productId);
      // BV is NOT sent: the backend derives BV from the product table, and the
      // MLM field guard rejects any client-supplied bv/totalBV fields.
      return {
        productId,
        quantity,
        unitPrice: prod?.distributorPrice || prod?.wholesalePrice || 0,
        totalPrice: (prod?.distributorPrice || prod?.wholesalePrice || 0) * quantity,
      };
    });

    try {
      if (selectedPaymentMethod === 'WALLET') {
        if (walletBalance < cartSummary.totalPrice) {
          showToast(
            `Insufficient wallet balance (₹${fmtINR(walletBalance)} available, ₹${fmtINR(cartSummary.totalPrice)} required)`
          );
          setIsProcessingOrder(false);
          return;
        }

        const res = await api.walletCheckout({
          items,
          amount: cartSummary.totalPrice,
          shippingAddress,
        });
        const order = res?.order || res;
        setOrderConfirmed({
          orderId: order?.id || `ORD-${Date.now()}`,
          orderNumber: order?.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
          date: new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          itemsCount: order?.items?.length || cartSummary.totalItems,
          totalAmount: Number(order?.totalAmount || cartSummary.totalPrice),
          creditedBV: Number(order?.totalBV || cartSummary.totalBV),
          memberId,
          memberName,
          paymentMethod: 'Commission Balance Wallet',
          paymentStatus: 'PAID',
          deliveryEta: '2-4 Business Days via Bluedart Express',
          shippingAddress: { ...shippingAddress },
        });
        setCartItems({});
        setCheckoutModal(false);
        showToast('Wholesale order placed & paid via Commission Balance Wallet!');
      } else {
        // Option B (UPI) or Option C (CARD) via Razorpay
        await ensureRazorpayLoaded();
        if (typeof window === 'undefined' || !window.Razorpay) {
          throw new Error('Razorpay checkout could not be loaded. No payment was taken — please try again.');
        }

        const rzpMethod = selectedPaymentMethod === 'CARD' ? 'CREDIT_CARD' : 'UPI';
        const rzpOrderData = await api.createRazorpayOrder({
          items,
          amount: cartSummary.totalPrice,
          shippingAddress,
          paymentMethod: rzpMethod,
        });

        const order = rzpOrderData?.order;
        const razorpayOrderId = rzpOrderData?.razorpayOrderId;
        // Never open Checkout without a real Razorpay order bound to a saved backend order:
        // otherwise money is collected for an order that does not exist and cannot be verified.
        if (!order?.id || !razorpayOrderId || razorpayOrderId.startsWith('order_mock')) {
          throw new Error('Could not create the payment order. No payment was taken — please try again.');
        }
        const keyId = rzpOrderData?.keyId || (await api.getRazorpayKeyId());
        const amountInPaise = rzpOrderData?.amount;

        {
          const options = {
            key: keyId,
            amount: amountInPaise,
            currency: 'INR',
            name: 'Kashvi International',
            description: `Wholesale Order ${order?.orderNumber || ''}`,
            order_id: razorpayOrderId,
            prefill: {
              name: shippingAddress.recipientName || memberName || user?.fullName || 'Distributor',
              contact: shippingAddress.phone || user?.phone || '9876543210',
              email: user?.email || 'distributor@kashvimlm.com',
            },
            notes: {
              orderNumber: order.orderNumber,
              distributorId: memberId,
              distributorName: memberName,
            },
            theme: {
              color: '#0d9488',
            },
            modal: {
              ondismiss: function () {
                setIsProcessingOrder(false);
                showToast('Payment window closed.');
              },
            },
            handler: async function (response) {
              try {
                const verifyRes = await api.verifyRazorpayPayment({
                  razorpayOrderId: response.razorpay_order_id || razorpayOrderId,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  orderId: order.id,
                });
                const confirmedOrder = verifyRes?.order || order;
                setOrderConfirmed({
                  orderId: confirmedOrder?.id || order?.id || `ORD-${Date.now()}`,
                  orderNumber:
                    confirmedOrder?.orderNumber ||
                    order?.orderNumber ||
                    `ORD-${Date.now().toString().slice(-6)}`,
                  date: new Date().toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }),
                  itemsCount: cartSummary.totalItems,
                  totalAmount: Number(confirmedOrder?.totalAmount || cartSummary.totalPrice),
                  creditedBV: Number(confirmedOrder?.totalBV || cartSummary.totalBV),
                  memberId,
                  memberName,
                  paymentMethod:
                    selectedPaymentMethod === 'UPI'
                      ? 'Razorpay (UPI / Instant QR)'
                      : 'Razorpay (Debit/Credit Card/NetBanking)',
                  paymentStatus: 'PAID',
                  deliveryEta: '2-4 Business Days via Bluedart Express',
                  paymentId: response.razorpay_payment_id,
                  shippingAddress: { ...shippingAddress },
                });
                setCartItems({});
                setCheckoutModal(false);
                showToast('Payment verified & Wholesale order confirmed!');
              } catch (err) {
                // Do NOT show a confirmed order: the backend has not verified this payment.
                console.error('Payment verification failed:', err);
                showToast(
                  `Payment ${response.razorpay_payment_id || ''} received but could not be verified (${
                    err.message || err
                  }). Order ${order.orderNumber} is pending — please contact support and do not pay again.`
                );
              } finally {
                setIsProcessingOrder(false);
              }
            },
          };

          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', function (resp) {
            setIsProcessingOrder(false);
            showToast('Payment failed: ' + (resp.error?.description || 'Declined'));
          });
          rzp.open();
        }
      }
    } catch (err) {
      showToast(err.message || 'Error processing wholesale checkout');
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Download GST Tax Invoice PDF
  const handleDownloadInvoice = async () => {
    if (!orderConfirmed || isDownloadingInvoice) return;
    setIsDownloadingInvoice(true);
    try {
      await api.downloadInvoice(orderConfirmed.orderId, orderConfirmed.orderNumber);
      showToast('GST Tax Invoice downloaded successfully!');
    } catch (err) {
      showToast('Download invoice failed: ' + (err.message || err));
    } finally {
      setIsDownloadingInvoice(false);
    }
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
              <span className="cart-box-val">₹{fmtINR(cartSummary.totalPrice)}</span>
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
          {canManageProducts && onNavigate && (
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
            const finalPrice = finalPriceOf(product);
            // MRP is tax-inclusive, so compare it against the final (DP + GST) price
            const discountPct =
              product.mrp > 0 && product.mrp > finalPrice
                ? Math.round(((product.mrp - finalPrice) / product.mrp) * 100)
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
                    <span className="distributor-price" title="Final price (DP + GST)">
                      ₹{fmtINR(finalPrice)}
                    </span>
                    {product.mrp > 0 && (
                      <span className="mrp-price">
                        ₹{fmtINR(product.mrp)}
                      </span>
                    )}
                  </div>
                  <span className="wholesale-tag">DP ₹{fmtINR(product.distributorPrice)}</span>
                </div>
                <div className="price-gst-note">
                  DP ₹{fmtINR(product.distributorPrice)} + {gstRateOf(product)}% GST ₹{fmtINR(lineGst(product))}
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
                  <span className="qv-distributor-price" title="Final price (DP + GST)">
                    ₹{fmtINR(finalPriceOf(activeQuickView))}
                  </span>
                  {activeQuickView.mrp > 0 && (
                    <span className="qv-mrp">MRP ₹{fmtINR(activeQuickView.mrp)}</span>
                  )}
                  <span className="qv-status-pill">{activeQuickView.status || 'In Stock'}</span>
                </div>
                <div className="price-gst-note">
                  DP ₹{fmtINR(activeQuickView.distributorPrice)} + {gstRateOf(activeQuickView)}% GST ₹
                  {fmtINR(lineGst(activeQuickView))} = ₹{fmtINR(finalPriceOf(activeQuickView))}
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
                          <span>
                            DP ₹{fmtINR(item.distributorPrice)} + {gstRateOf(item)}% GST each
                          </span>
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
                        ₹{fmtINR(finalPriceOf(item, qty))}
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
                    -₹{fmtINR(cartSummary.totalSavings)}
                  </span>
                </div>

                <div className="cart-calc-row">
                  <span>DP Subtotal:</span>
                  <span>₹{fmtINR(cartSummary.totalWithoutGst)}</span>
                </div>

                <div className="cart-calc-row">
                  <span>GST:</span>
                  <span>+₹{fmtINR(cartSummary.totalGst)}</span>
                </div>

                <div className="cart-calc-row total">
                  <span>Payable Total (DP + GST):</span>
                  <strong className="total-amount">
                    ₹{fmtINR(cartSummary.totalPrice)}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 className="section-subtitle" style={{ margin: 0 }}>1. Delivery Address</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setTempAddress(shippingAddress);
                      setIsEditingAddress((prev) => !prev);
                    }}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      backgroundColor: isEditingAddress ? '#fee2e2' : '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: isEditingAddress ? '#b91c1c' : '#0369a1',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isEditingAddress ? 'Cancel Edit' : 'Change Address'}
                  </button>
                </div>

                {!isEditingAddress ? (
                  <div className="address-box-selected">
                    <strong>{shippingAddress.recipientName || memberName}</strong>
                    <p>{shippingAddress.streetAddress}, {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.postalCode}</p>
                    <p>Phone: {shippingAddress.phone} • Country: {shippingAddress.country || 'India'}</p>
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#166534', fontWeight: 600 }}>
                      <Check size={12} />
                      <span>Permanently saved delivery address</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Recipient Name *</label>
                        <input
                          type="text"
                          value={tempAddress.recipientName || ''}
                          onChange={(e) => setTempAddress({ ...tempAddress, recipientName: e.target.value })}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Mobile Phone *</label>
                        <input
                          type="tel"
                          value={tempAddress.phone || ''}
                          onChange={(e) => setTempAddress({ ...tempAddress, phone: e.target.value })}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Proper Address *</label>
                      <input
                        type="text"
                        value={tempAddress.streetAddress || ''}
                        onChange={(e) => setTempAddress({ ...tempAddress, streetAddress: e.target.value })}
                        style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>City *</label>
                        <input
                          type="text"
                          value={tempAddress.city || ''}
                          onChange={(e) => setTempAddress({ ...tempAddress, city: e.target.value })}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>State *</label>
                        <input
                          type="text"
                          value={tempAddress.state || ''}
                          onChange={(e) => setTempAddress({ ...tempAddress, state: e.target.value })}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>PIN Code *</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={tempAddress.postalCode || ''}
                          onChange={(e) => setTempAddress({ ...tempAddress, postalCode: e.target.value })}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingAddress(false)}
                        style={{ padding: '6px 12px', fontSize: '12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAddress}
                        style={{ padding: '6px 14px', fontSize: '12px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Save & Use Address
                      </button>
                    </div>
                  </div>
                )}

                <h4 className="section-subtitle" style={{ marginTop: '16px' }}>
                  2. Payment Method
                </h4>
                <div className="payment-options-list">
                  <label
                    className={`payment-radio-row ${selectedPaymentMethod === 'WALLET' ? 'selected' : ''}`}
                    onClick={() => setSelectedPaymentMethod('WALLET')}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="payMethod"
                      value="WALLET"
                      checked={selectedPaymentMethod === 'WALLET'}
                      onChange={() => setSelectedPaymentMethod('WALLET')}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong>Option A: Commission Balance Wallet</strong>
                        {walletBalance < cartSummary.totalPrice && (
                          <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
                            (Insufficient Funds)
                          </span>
                        )}
                      </div>
                      <span>
                        Pay directly from accumulated weekly commission balance (
                        {isLoadingWallet
                          ? 'Checking balance...'
                          : `₹${fmtINR(walletBalance)} available`}
                        )
                      </span>
                    </div>
                  </label>

                  <label
                    className={`payment-radio-row ${selectedPaymentMethod === 'UPI' ? 'selected' : ''}`}
                    onClick={() => setSelectedPaymentMethod('UPI')}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="payMethod"
                      value="UPI"
                      checked={selectedPaymentMethod === 'UPI'}
                      onChange={() => setSelectedPaymentMethod('UPI')}
                    />
                    <div>
                      <strong>Option B: UPI / Instant QR Payment</strong>
                      <span>Google Pay, PhonePe, Paytm, BHIM UPI (via Razorpay Gateway)</span>
                    </div>
                  </label>

                  <label
                    className={`payment-radio-row ${selectedPaymentMethod === 'CARD' ? 'selected' : ''}`}
                    onClick={() => setSelectedPaymentMethod('CARD')}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="payMethod"
                      value="CARD"
                      checked={selectedPaymentMethod === 'CARD'}
                      onChange={() => setSelectedPaymentMethod('CARD')}
                    />
                    <div>
                      <strong>Option C: Debit / Credit Card / NetBanking</strong>
                      <span>All major Indian commercial banks supported (via Razorpay Gateway)</span>
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
                    <span>DP Subtotal:</span>
                    <span>₹{fmtINR(cartSummary.totalWithoutGst)}</span>
                  </div>
                  <div className="summary-line">
                    <span>GST:</span>
                    <span>+₹{fmtINR(cartSummary.totalGst)}</span>
                  </div>
                  <div className="summary-line">
                    <span>Shipping & Handling:</span>
                    <span className="text-green font-semibold">FREE (Distributor Perk)</span>
                  </div>
                  <div className="summary-line highlight-bv">
                    <span>Volume Credited:</span>
                    <strong>+{cartSummary.totalBV} BV Points</strong>
                  </div>
                  <div className="summary-line grand-total">
                    <span>Total Payable (DP + GST):</span>
                    <strong>₹{fmtINR(cartSummary.totalPrice)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-place-order"
                  disabled={isProcessingOrder}
                  onClick={handleConfirmOrder}
                  style={{
                    opacity: isProcessingOrder ? 0.7 : 1,
                    cursor: isProcessingOrder ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isProcessingOrder ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Processing Order...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>
                        {selectedPaymentMethod === 'WALLET'
                          ? 'Pay from Wallet & Place Order'
                          : 'Proceed to Razorpay Checkout'}
                      </span>
                    </>
                  )}
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
              <h2 className="invoice-title">Wholesale Order Confirmed!</h2>
              <p className="invoice-subtitle">
                Your wholesale payment has been verified and registered on the blockchain BV ledger.
              </p>
            </div>

            <div className="invoice-details-card">
              <div className="inv-row">
                <span>Order Reference:</span>
                <strong style={{ letterSpacing: '0.5px' }}>
                  {orderConfirmed.orderNumber || orderConfirmed.orderId}
                </strong>
              </div>
              <div className="inv-row">
                <span>Order Date:</span>
                <span>{orderConfirmed.date}</span>
              </div>
              <div className="inv-row">
                <span>Buyer / Distributor:</span>
                <span>
                  {orderConfirmed.memberName} (ID: {orderConfirmed.memberId})
                </span>
              </div>
              <div className="inv-row">
                <span>Payment Method:</span>
                <strong style={{ color: '#0f766e' }}>{orderConfirmed.paymentMethod}</strong>
              </div>
              <div className="inv-row">
                <span>Payment Status:</span>
                <span
                  style={{
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  PAID & VERIFIED
                </span>
              </div>
              <div className="inv-row">
                <span>Items Ordered:</span>
                <span>{orderConfirmed.itemsCount} products</span>
              </div>
              <div className="inv-row">
                <span>Volume Points Credited:</span>
                <strong className="text-teal font-bold">
                  +{orderConfirmed.creditedBV} BV Points
                </strong>
              </div>
              <div className="inv-row">
                <span>Total Amount Paid:</span>
                <strong className="inv-price">
                  ₹{fmtINR(orderConfirmed.totalAmount)}
                </strong>
              </div>
              <div className="inv-row">
                <span>Estimated Delivery:</span>
                <span>{orderConfirmed.deliveryEta}</span>
              </div>
              {orderConfirmed.shippingAddress && (
                <>
                  <div className="inv-row">
                    <span>Delivery Address:</span>
                    <span style={{ textAlign: 'right', maxWidth: '320px', fontWeight: 600, color: '#0f172a' }}>
                      {orderConfirmed.shippingAddress.streetAddress}, {orderConfirmed.shippingAddress.city}, {orderConfirmed.shippingAddress.state} - {orderConfirmed.shippingAddress.postalCode}
                    </span>
                  </div>
                  <div className="inv-row">
                    <span>Recipient & Contact:</span>
                    <span>
                      {orderConfirmed.shippingAddress.recipientName} ({orderConfirmed.shippingAddress.phone})
                    </span>
                  </div>
                </>
              )}
              {orderConfirmed.paymentId && (
                <div className="inv-row">
                  <span>Razorpay Payment ID:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f766e' }}>
                    {orderConfirmed.paymentId}
                  </span>
                </div>
              )}
            </div>

            <div className="invoice-actions-row">
              <button
                type="button"
                className="btn-invoice-action primary"
                disabled={isDownloadingInvoice}
                onClick={handleDownloadInvoice}
              >
                {isDownloadingInvoice ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Downloading PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Download GST Invoice (PDF)</span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn-invoice-action secondary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>Print Tax Invoice</span>
              </button>
              <button
                type="button"
                className="btn-invoice-action outline"
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
