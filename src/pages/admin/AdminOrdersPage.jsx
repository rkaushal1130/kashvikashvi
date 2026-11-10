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
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
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

  // Real-time synchronization event listeners & background polling
  useEffect(() => {
    fetchOrders();

    const handleRealtimeUpdate = (e) => {
      console.log('[AdminOrdersPage] Real-time order event detected:', e?.type, e?.detail);
      fetchOrders();
    };

    window.addEventListener('kashvi_order_placed', handleRealtimeUpdate);
    window.addEventListener('kashvi_orders_updated', handleRealtimeUpdate);
    window.addEventListener('kashvi_member_paid', handleRealtimeUpdate);
    
    // Cross-tab storage synchronization
    const handleStorageChange = (e) => {
      if (e.key === 'kashvi_orders' || e.key === 'kashvi_auth') {
        fetchOrders();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 15-second background sync to pull newly placed member orders automatically
    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);

    return () => {
      window.removeEventListener('kashvi_order_placed', handleRealtimeUpdate);
      window.removeEventListener('kashvi_orders_updated', handleRealtimeUpdate);
      window.removeEventListener('kashvi_member_paid', handleRealtimeUpdate);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [fetchOrders]);

  // Compute 5 KPI summary metrics (Requirement 7)
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
    // Credited BV according to Requirement 11: Credited only for confirmed/paid orders
    const totalBV = orders.reduce((acc, o) => {
      const isPaid =
        o.isPaid ||
        o.paymentStatus === 'PAID' ||
        ['DELIVERED', 'SHIPPED', 'CONFIRMED', 'PAID', 'COMPLETED'].includes(o.status?.toUpperCase());
      return isPaid ? acc + (Number(o.totalBV) || 0) : acc;
    }, 0);
    const paidOrders = orders.filter((o) =>
      o.isPaid ||
      o.paymentStatus === 'PAID' ||
      ['PAID', 'DELIVERED', 'SHIPPED', 'CONFIRMED', 'COMPLETED'].includes(o.status?.toUpperCase())
    ).length;
    const pendingOrders = orders.filter((o) =>
      !o.isPaid &&
      o.paymentStatus !== 'PAID' &&
      ['PENDING', 'PAYMENT_PENDING', 'PROCESSING'].includes((o.status || o.paymentStatus)?.toUpperCase())
    ).length;

    return { totalOrders, totalRevenue, totalBV, paidOrders, pendingOrders };
  }, [orders]);

  // Determine if a member's Kashvi MLM ID should be styled green (paid) or inactive (gray)
  const isMemberIdGreen = (order) => {
    if (order.isPaid || order.paymentStatus === 'PAID') return true;
    if (order.isMemberPaid) return true;
    const memberCode = (order.distributorCode || order.memberId || '').toUpperCase();
    if (!memberCode) return false;
    try {
      const auth = JSON.parse(localStorage.getItem('kashvi_auth') || '{}');
      const authUser = auth.user;
      if (authUser) {
        const uId = (
          authUser.distributorCode ||
          authUser.memberId ||
          authUser.distributorProfile?.distributorCode ||
          ''
        ).toUpperCase();
        if (
          uId === memberCode &&
          (authUser.isPaid || authUser.paymentStatus === 'PAID' || authUser.accountStatus === 'ACTIVE')
        ) {
          return true;
        }
      }
      const users = JSON.parse(localStorage.getItem('kashvi_registered_users') || '[]');
      const matched = users.find(
        (u) =>
          ((u.distributorCode || u.distributorId || u.memberId || '').toUpperCase()) === memberCode
      );
      if (
        matched &&
        (matched.isPaid || matched.paymentStatus === 'PAID' || matched.status === 'ACTIVE' || matched.accountStatus === 'ACTIVE')
      ) {
        return true;
      }
      const tree = JSON.parse(localStorage.getItem('kashvi_enrolled_tree_members') || '[]');
      const treeMember = tree.find(
        (m) =>
          ((m.distributorId || m.memberId || '').toUpperCase()) === memberCode
      );
      if (treeMember && (treeMember.isPaid || treeMember.paymentStatus === 'PAID' || treeMember.status === 'ACTIVE')) {
        return true;
      }
    } catch {}
    return false;
  };

  // Search & Filtered orders list (Requirement 8)
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Order Processing Status filter
      if (orderStatusFilter !== 'ALL') {
        const os = (order.status || '').toUpperCase();
        if (os !== orderStatusFilter) return false;
      }

      // Payment Status filter
      if (paymentStatusFilter !== 'ALL') {
        const rawPs = (order.paymentStatus || (order.isPaid ? 'PAID' : 'PENDING')).toUpperCase();
        let ps = 'PENDING';
        if (rawPs === 'PAID' || rawPs === 'COMPLETED' || order.isPaid) ps = 'PAID';
        else if (rawPs === 'FAILED' || rawPs === 'DECLINED') ps = 'FAILED';
        else if (rawPs === 'PROCESSING') ps = 'PROCESSING';
        else ps = 'PENDING';

        if (ps !== paymentStatusFilter) return false;
      }

      // Search term: Order Number, Member Name, Kashvi MLM ID, phone, email, products
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const orderNum = (order.orderNumber || order.id || '').toLowerCase();
      const name = (order.customerName || order.user?.fullName || order.shippingAddress?.recipientName || '').toLowerCase();
      const email = (order.customerEmail || order.user?.email || '').toLowerCase();
      const phone = (order.customerPhone || order.shippingAddress?.phone || '').toLowerCase();
      const distCode = (order.distributorCode || order.memberId || '').toLowerCase();
      const itemsMatch = (order.items || []).some((item) =>
        (item.productName || item.product?.name || item.sku || '').toLowerCase().includes(q)
      );

      return (
        orderNum.includes(q) ||
        name.includes(q) ||
        distCode.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        itemsMatch
      );
    });
  }, [orders, orderStatusFilter, paymentStatusFilter, searchTerm]);

  // Handle Order Status Update (Requirement 5)
  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    setIsUpdatingStatus(true);
    try {
      await adminApi.updateOrderStatus(selectedOrder.id, newStatus, statusNotes);
      showToast(`Order #${selectedOrder.orderNumber || selectedOrder.id} status updated to ${newStatus}`);

      const isPaidNow = ['PAID', 'CONFIRMED', 'DELIVERED'].includes(newStatus) || selectedOrder.isPaid;
      const updatedPaymentStatus = isPaidNow ? 'PAID' : selectedOrder.paymentStatus;

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrder.id
            ? { ...o, status: newStatus, paymentStatus: updatedPaymentStatus, isPaid: isPaidNow }
            : o
        )
      );
      setSelectedOrder((prev) =>
        prev ? { ...prev, status: newStatus, paymentStatus: updatedPaymentStatus, isPaid: isPaidNow } : null
      );
    } catch (err) {
      console.error('[AdminOrdersPage] Status update failed:', err);
      showToast('Failed to update status. Please try again.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Payment Status Badge (Requirement 4)
  const renderPaymentStatusBadge = (paymentStatus, isPaid) => {
    const raw = (paymentStatus || (isPaid ? 'PAID' : 'PENDING')).toUpperCase();
    let badgeClass = 'pending';
    let icon = <Clock size={12} />;
    let label = 'PENDING';

    if (raw === 'PAID' || raw === 'COMPLETED' || isPaid) {
      badgeClass = 'paid';
      icon = <CheckCircle2 size={12} />;
      label = 'PAID';
    } else if (raw === 'FAILED' || raw === 'DECLINED') {
      badgeClass = 'failed';
      icon = <XCircle size={12} />;
      label = 'FAILED';
    } else if (raw === 'PROCESSING') {
      badgeClass = 'processing';
      icon = <RefreshCw size={12} className="animate-spin" />;
      label = 'PROCESSING';
    } else {
      badgeClass = 'pending';
      icon = <Clock size={12} />;
      label = 'PENDING';
    }

    return (
      <span className={`payment-status-badge ${badgeClass}`}>
        {icon}
        <span>{label}</span>
      </span>
    );
  };

  // Order Processing Status Badge (Requirement 5)
  const renderOrderStatusBadge = (status) => {
    const s = (status || 'PENDING').toUpperCase();
    let badgeClass = 'badge-neutral';
    let icon = <Clock size={13} />;

    switch (s) {
      case 'DELIVERED':
      case 'COMPLETED':
        badgeClass = 'badge-success';
        icon = <CheckCircle2 size={13} />;
        break;
      case 'SHIPPED':
        badgeClass = 'badge-info';
        icon = <Truck size={13} />;
        break;
      case 'CONFIRMED':
        badgeClass = 'badge-success';
        icon = <ShieldCheck size={13} />;
        break;
      case 'PROCESSING':
        badgeClass = 'badge-info';
        icon = <RefreshCw size={13} className="animate-spin" />;
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
            Comprehensive real-time ledger of distributor wholesale purchases, retail orders, verified payment receipts, and credited BV volume.
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

      {/* 2. KPI Metrics Grid (Requirement 7) */}
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

      {/* 3. Filter & Search Bar (Requirement 8) */}
      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Order #, Member Name, Kashvi MLM ID..."
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

        {/* Payment Status Filter */}
        <div className="admin-filter-group">
          <Filter size={15} className="filter-icon" />
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="admin-select-filter"
            title="Filter by Payment Status"
          >
            <option value="ALL">All Payments</option>
            <option value="PAID">PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>

        {/* Order Status Filter */}
        <div className="admin-filter-group">
          <Filter size={15} className="filter-icon" />
          <select
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value)}
            className="admin-select-filter"
            title="Filter by Order Status"
          >
            <option value="ALL">All Order Statuses ({orders.length})</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* 4. Orders Table (Requirement 3: Display Complete Order Details) */}
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
              {searchTerm || orderStatusFilter !== 'ALL' || paymentStatusFilter !== 'ALL'
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
                <th>Kashvi MLM ID</th>
                <th>Items &amp; Products</th>
                <th>Amount (₹)</th>
                <th>Credited BV</th>
                <th>Payment Method</th>
                <th>Payment Status</th>
                <th>Order Status</th>
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
                const memberIdVal = order.distributorCode || order.memberId || 'KK-0002';
                const isGreen = isMemberIdGreen(order);

                return (
                  <tr key={order.id} className="admin-table-row">
                    <td>
                      <button
                        type="button"
                        className="order-number-link"
                        onClick={() => {
                          setSelectedOrder(order);
                          setNewStatus(order.status || 'PENDING');
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
                          {order.customerEmail || order.customerPhone || 'Member'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`order-member-id ${isGreen ? 'id-paid-green' : 'id-unpaid-inactive'}`}>
                        {memberIdVal}
                      </span>
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
                    <td>{renderPaymentStatusBadge(order.paymentStatus, order.isPaid)}</td>
                    <td>{renderOrderStatusBadge(order.status)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn-action"
                        onClick={() => {
                          setSelectedOrder(order);
                          setNewStatus(order.status || 'PENDING');
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

      {/* 5. Complete Order Details Modal (Requirement 6) */}
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
                  {renderOrderStatusBadge(selectedOrder.status)}
                  {renderPaymentStatusBadge(selectedOrder.paymentStatus, selectedOrder.isPaid)}
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
                      <span className="info-key">Buyer Name:</span>
                      <strong className="info-val">{selectedOrder.customerName || 'Distributor'}</strong>
                    </div>
                    <div className="info-line">
                      <span className="info-key">Kashvi MLM ID:</span>
                      <span
                        className={`order-member-id ${
                          isMemberIdGreen(selectedOrder) ? 'id-paid-green' : 'id-unpaid-inactive'
                        }`}
                      >
                        {selectedOrder.distributorCode || selectedOrder.memberId || 'KK-0002'}
                      </span>
                    </div>
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
                            {selectedOrder.shippingAddress.streetAddress ||
                              selectedOrder.shippingAddress.addressLine1 ||
                              'Main Warehouse Road'}
                          </span>
                        </div>
                        <div className="info-line">
                          <span className="info-key">City / State:</span>
                          <span className="info-val">
                            {selectedOrder.shippingAddress.city || 'Ambala City'},{' '}
                            {selectedOrder.shippingAddress.state || 'Haryana'} -{' '}
                            {selectedOrder.shippingAddress.postalCode || '134007'}
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
                              <span className="item-product-name">
                                {item.productName || item.product?.name || 'Product Item'}
                              </span>
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
                            <strong>
                              ₹{Number(item.totalPrice || item.unitPrice * (item.quantity || 1) || 0).toLocaleString('en-IN')}
                            </strong>
                          </td>
                          <td>
                            <span className="table-bv-badge">
                              +{Number(item.totalBV || item.unitBV * (item.quantity || 1) || 0)} BV
                            </span>
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
                      <span className="info-key">Payment Method:</span>
                      <strong className="info-val">{selectedOrder.paymentMethod || 'WALLET'}</strong>
                    </div>
                    <div className="info-line">
                      <span className="info-key">Payment Status:</span>
                      <span className="info-val">
                        {renderPaymentStatusBadge(selectedOrder.paymentStatus, selectedOrder.isPaid)}
                      </span>
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
                      <span className="info-val">
                        ₹{Number(selectedOrder.subtotal || selectedOrder.totalAmount).toLocaleString('en-IN')}
                      </span>
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
                      <span className="info-key">Credited BV Volume:</span>
                      <strong className="info-val bv-value">
                        +{Number(selectedOrder.totalBV || 0)} BV
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Admin Fulfillment Control (Requirement 5) */}
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
                      <option value="PENDING">PENDING</option>
                      <option value="PROCESSING">PROCESSING</option>
                      <option value="CONFIRMED">CONFIRMED</option>
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
