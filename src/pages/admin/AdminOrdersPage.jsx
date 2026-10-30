import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { adminApi } from '../../api/adminApi';
import { api } from '../../services/api';
import {
  ShoppingBag,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  AlertCircle,
  Package,
  Calendar,
  User,
  Phone,
  MapPin,
  CreditCard,
  Award,
  ArrowRight,
  X,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import './AdminPages.css';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getOrders();
      if (res && res.data) {
        const orderList = Array.isArray(res.data) ? res.data : (res.data.items || []);
        setOrders(orderList);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.warn('[AdminOrdersPage] Failed to fetch orders from backend:', err);
      setError('Unable to load orders from server. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Compute KPI summary metrics
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
    const totalBV = orders.reduce((acc, o) => acc + (Number(o.totalBV) || 0), 0);
    const paidOrders = orders.filter((o) =>
      ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(o.status?.toUpperCase())
    ).length;
    const pendingOrders = orders.filter((o) =>
      ['PENDING', 'PAYMENT_PENDING'].includes(o.status?.toUpperCase())
    ).length;

    return { totalOrders, totalRevenue, totalBV, paidOrders, pendingOrders };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter !== 'ALL' && order.status?.toUpperCase() !== statusFilter) {
        return false;
      }
      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const orderNum = (order.orderNumber || order.id || '').toLowerCase();
      const name = (order.customerName || order.user?.fullName || order.shippingAddress?.recipientName || '').toLowerCase();
      const email = (order.customerEmail || order.user?.email || '').toLowerCase();
      const phone = (order.customerPhone || order.shippingAddress?.phone || '').toLowerCase();
      const distCode = (order.distributorCode || '').toLowerCase();
      const itemsMatch = (order.items || []).some((item) =>
        (item.productName || item.product?.name || '').toLowerCase().includes(q)
      );

      return (
        orderNum.includes(q) ||
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        distCode.includes(q) ||
        itemsMatch
      );
    });
  }, [orders, statusFilter, searchTerm]);

  // Handle Status Update
  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    setIsUpdatingStatus(true);
    try {
      await adminApi.updateOrderStatus(selectedOrder.id, newStatus, statusNotes);
      showToast(`Order #${selectedOrder.orderNumber || selectedOrder.id} status updated to ${newStatus}`);
      
      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrder.id ? { ...o, status: newStatus } : o
        )
      );
      setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (err) {
      console.error('[AdminOrdersPage] Status update failed:', err);
      showToast('Failed to update status. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status) => {
    const s = (status || 'PENDING').toUpperCase();
    let badgeClass = 'badge-neutral';
    let icon = <Clock size={13} />;

    switch (s) {
      case 'PAID':
      case 'COMPLETED':
      case 'DELIVERED':
        badgeClass = 'badge-success';
        icon = <CheckCircle2 size={13} />;
        break;
      case 'PROCESSING':
      case 'SHIPPED':
        badgeClass = 'badge-info';
        icon = <Truck size={13} />;
        break;
      case 'PENDING':
      case 'PAYMENT_PENDING':
        badgeClass = 'badge-warning';
        icon = <Clock size={13} />;
        break;
      case 'CANCELLED':
      case 'REFUNDED':
        badgeClass = 'badge-danger';
        icon = <XCircle size={13} />;
        break;
      default:
        badgeClass = 'badge-neutral';
    }

    return (
      <span className={`admin-status-badge ${badgeClass}`}>
        {icon}
        <span>{s}</span>
      </span>
    );
  };

  return (
    <div className="admin-page-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="admin-toast-banner">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Page Header */}
      <div className="admin-page-header">
        <div className="admin-header-titles">
          <div className="admin-page-badge">
            <ShieldCheck size={12} />
            <span>Orders &amp; Fulfillment Audit</span>
          </div>
          <h1 className="admin-page-title">Orders Management</h1>
          <p className="admin-page-subtitle">
            Comprehensive ledger of distributor wholesale purchases, customer orders, payment receipts, and commissionable BV volume.
          </p>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={fetchOrders}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Grid */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="kpi-icon-wrap bg-blue">
            <ShoppingBag size={20} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Total Orders</span>
            <strong className="kpi-value">{metrics.totalOrders}</strong>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-icon-wrap bg-green">
            <CreditCard size={20} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Gross Revenue</span>
            <strong className="kpi-value">₹{metrics.totalRevenue.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-icon-wrap bg-teal">
            <Award size={20} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Total Credited BV</span>
            <strong className="kpi-value">+{metrics.totalBV.toLocaleString('en-IN')} BV</strong>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-icon-wrap bg-purple">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Paid &amp; Settled</span>
            <strong className="kpi-value">{metrics.paidOrders} Orders</strong>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="kpi-icon-wrap bg-orange">
            <Clock size={20} />
          </div>
          <div className="kpi-meta">
            <span className="kpi-label">Pending / Processing</span>
            <strong className="kpi-value">{metrics.pendingOrders} Orders</strong>
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Order #, Distributor, Email, Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search-input"
          />
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="admin-filter-group">
          <Filter size={15} className="filter-icon" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select-filter"
          >
            <option value="ALL">All Statuses ({orders.length})</option>
            <option value="PAID">Paid</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="PENDING">Pending</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      {/* 4. Orders Table */}
      <div className="admin-table-container">
        {loading ? (
          <div className="admin-table-empty">
            <RefreshCw size={32} className="animate-spin text-blue" />
            <p>Loading database orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-table-empty">
            <Package size={48} className="empty-icon" />
            <h3>No Orders Found</h3>
            <p>
              {searchTerm || statusFilter !== 'ALL'
                ? 'No orders match your filter criteria. Try resetting filters.'
                : 'No wholesale distributor or retail orders have been recorded yet.'}
            </p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Date &amp; Time</th>
                <th>Distributor / Buyer</th>
                <th>Items &amp; Products</th>
                <th>Amount (₹)</th>
                <th>Credited BV</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const orderNum = order.orderNumber || order.id?.slice(0, 12);
                const dateFormatted = order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'N/A';
                const itemsCount = (order.items || []).reduce(
                  (acc, i) => acc + (i.quantity || 1),
                  0
                );
                const firstItemName = order.items?.[0]?.productName || order.items?.[0]?.product?.name || 'Store Items';

                return (
                  <tr key={order.id} className="admin-table-row">
                    <td>
                      <button
                        type="button"
                        className="order-number-link"
                        onClick={() => {
                          setSelectedOrder(order);
                          setNewStatus(order.status || 'PAID');
                        }}
                      >
                        {orderNum}
                      </button>
                    </td>
                    <td>
                      <div className="table-date-cell">
                        <Calendar size={13} />
                        <span>{dateFormatted}</span>
                      </div>
                    </td>
                    <td>
                      <div className="table-user-cell">
                        <span className="user-name-cell">{order.customerName || 'Distributor'}</span>
                        <span className="user-sub-cell">
                          {order.distributorCode || order.customerEmail || 'KV-1001'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="table-items-cell">
                        <span className="items-primary-title">
                          {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}
                        </span>
                        <span className="items-sub-title">{firstItemName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="table-price-cell">
                        ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      <span className="table-bv-badge">
                        +{Number(order.totalBV || 0)} BV
                      </span>
                    </td>
                    <td>
                      <span className="table-payment-pill">
                        {order.paymentMethod || 'WALLET'}
                      </span>
                    </td>
                    <td>{renderStatusBadge(order.status)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn-action"
                        onClick={() => {
                          setSelectedOrder(order);
                          setNewStatus(order.status || 'PAID');
                        }}
                        title="View Full Order Details"
                        aria-label={`View Details for ${orderNum}`}
                      >
                        <Eye size={15} />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Order Details Modal */}
      {selectedOrder && (
        <div className="admin-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div
            className="admin-modal-container order-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="admin-modal-header">
              <div className="modal-header-left">
                <div className="modal-badge-row">
                  <Package size={16} />
                  <span>Order Inspection</span>
                  {renderStatusBadge(selectedOrder.status)}
                </div>
                <h2 className="admin-modal-title">
                  Order #{selectedOrder.orderNumber || selectedOrder.id}
                </h2>
                <span className="modal-date-subtitle">
                  Placed on{' '}
                  {selectedOrder.createdAt
                    ? new Date(selectedOrder.createdAt).toLocaleString('en-IN')
                    : 'Recent'}
                </span>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedOrder(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="admin-modal-body order-modal-body">
              {/* Row 1: Customer & Delivery Address */}
              <div className="order-details-grid two-col">
                <div className="order-info-card">
                  <h4 className="info-card-title">
                    <User size={16} />
                    <span>Customer &amp; Distributor Information</span>
                  </h4>
                  <div className="info-card-content">
                    <div className="info-line">
                      <span className="info-key">Name:</span>
                      <strong className="info-val">{selectedOrder.customerName || 'Distributor'}</strong>
                    </div>
                    {selectedOrder.distributorCode && (
                      <div className="info-line">
                        <span className="info-key">Distributor ID:</span>
                        <span className="info-val dist-code-tag">{selectedOrder.distributorCode}</span>
                      </div>
                    )}
                    {selectedOrder.customerEmail && (
                      <div className="info-line">
                        <span className="info-key">Email:</span>
                        <span className="info-val">{selectedOrder.customerEmail}</span>
                      </div>
                    )}
                    {selectedOrder.customerPhone && (
                      <div className="info-line">
                        <span className="info-key">Phone:</span>
                        <span className="info-val">{selectedOrder.customerPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="order-info-card">
                  <h4 className="info-card-title">
                    <MapPin size={16} />
                    <span>Shipping Destination</span>
                  </h4>
                  <div className="info-card-content">
                    {selectedOrder.shippingAddress ? (
                      <>
                        <div className="info-line">
                          <span className="info-key">Recipient:</span>
                          <strong className="info-val">
                            {selectedOrder.shippingAddress.recipientName || selectedOrder.customerName}
                          </strong>
                        </div>
                        <div className="info-line">
                          <span className="info-key">Address:</span>
                          <span className="info-val">
                            {selectedOrder.shippingAddress.streetAddress || selectedOrder.shippingAddress.addressLine1 || 'Main Warehouse Road'}
                          </span>
                        </div>
                        <div className="info-line">
                          <span className="info-key">City / State:</span>
                          <span className="info-val">
                            {selectedOrder.shippingAddress.city || 'Ambala City'}, {selectedOrder.shippingAddress.state || 'Haryana'} - {selectedOrder.shippingAddress.postalCode || '134007'}
                          </span>
                        </div>
                        <div className="info-line">
                          <span className="info-key">Country:</span>
                          <span className="info-val">{selectedOrder.shippingAddress.country || 'India'}</span>
                        </div>
                      </>
                    ) : (
                      <p className="no-address-note">Standard Corporate Delivery on File</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Order Items Purchased */}
              <div className="order-items-section">
                <h4 className="section-subtitle">
                  <Package size={16} />
                  <span>Purchased Products ({(selectedOrder.items || []).length} items)</span>
                </h4>
                <div className="order-items-table-wrap">
                  <table className="order-items-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Unit Price</th>
                        <th>Unit BV</th>
                        <th>Qty</th>
                        <th>Total Price</th>
                        <th>Total BV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedOrder.items || []).map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td>
                            <div className="item-title-wrap">
                              <div className="item-thumb-box">
                                {item.thumbnailUrl ? (
                                  <img src={item.thumbnailUrl} alt={item.productName} />
                                ) : (
                                  <Package size={16} />
                                )}
                              </div>
                              <span className="item-product-name">{item.productName || item.product?.name || 'Product Item'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="sku-tag">{item.sku || item.product?.sku || 'KV-PROD'}</span>
                          </td>
                          <td>₹{Number(item.unitPrice || 0).toLocaleString('en-IN')}</td>
                          <td>+{Number(item.unitBV || 0)} BV</td>
                          <td>
                            <strong className="qty-tag">×{item.quantity || 1}</strong>
                          </td>
                          <td>
                            <strong>₹{Number(item.totalPrice || (item.unitPrice * item.quantity) || 0).toLocaleString('en-IN')}</strong>
                          </td>
                          <td>
                            <span className="table-bv-badge">+{Number(item.totalBV || 0)} BV</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 3: Financial & Payment Breakdown */}
              <div className="order-details-grid two-col">
                <div className="order-info-card">
                  <h4 className="info-card-title">
                    <CreditCard size={16} />
                    <span>Payment &amp; Settlement</span>
                  </h4>
                  <div className="info-card-content">
                    <div className="info-line">
                      <span className="info-key">Payment Rail:</span>
                      <strong className="info-val">{selectedOrder.paymentMethod || 'Commission Balance Wallet'}</strong>
                    </div>
                    <div className="info-line">
                      <span className="info-key">Payment Status:</span>
                      <span className="info-val">{renderStatusBadge(selectedOrder.paymentStatus || 'PAID')}</span>
                    </div>
                    {selectedOrder.paidAt && (
                      <div className="info-line">
                        <span className="info-key">Paid Timestamp:</span>
                        <span className="info-val">{new Date(selectedOrder.paidAt).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {selectedOrder.trackingNumber && (
                      <div className="info-line">
                        <span className="info-key">Courier Tracking #:</span>
                        <span className="info-val tracking-tag">{selectedOrder.trackingNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="order-info-card totals-card">
                  <h4 className="info-card-title">
                    <FileText size={16} />
                    <span>Financial Summary</span>
                  </h4>
                  <div className="info-card-content">
                    <div className="info-line">
                      <span className="info-key">Subtotal:</span>
                      <span className="info-val">₹{Number(selectedOrder.subtotal || selectedOrder.totalAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="info-line">
                      <span className="info-key">Shipping &amp; Logistics:</span>
                      <span className="info-val text-green">FREE</span>
                    </div>
                    <div className="info-line">
                      <span className="info-key">Applicable Taxes (GST):</span>
                      <span className="info-val">₹{Number(selectedOrder.taxAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="info-line grand-total-line">
                      <span className="info-key">Grand Total:</span>
                      <strong className="info-val total-amount-value">
                        ₹{Number(selectedOrder.totalAmount || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div className="info-line bv-total-line">
                      <span className="info-key">Commissionable Volume:</span>
                      <strong className="info-val bv-value">
                        +{Number(selectedOrder.totalBV || 0)} BV
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Admin Fulfillment Control */}
              <div className="admin-order-status-card">
                <h4 className="info-card-title">
                  <Truck size={16} />
                  <span>Update Order Status &amp; Fulfillment</span>
                </h4>
                <div className="status-update-row">
                  <div className="status-select-wrap">
                    <label>Fulfillment Status:</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="admin-select-input"
                    >
                      <option value="PAID">PAID</option>
                      <option value="PROCESSING">PROCESSING</option>
                      <option value="SHIPPED">SHIPPED</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>

                  <div className="status-notes-wrap">
                    <label>Admin Tracking / Note:</label>
                    <input
                      type="text"
                      placeholder="e.g. Dispatched via Bluedart AWB #849201"
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      className="admin-text-input"
                    />
                  </div>

                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={handleUpdateStatus}
                    disabled={isUpdatingStatus}
                  >
                    {isUpdatingStatus ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>Update Status</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="admin-modal-footer">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
