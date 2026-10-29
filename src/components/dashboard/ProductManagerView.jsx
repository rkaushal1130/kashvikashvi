import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  PackagePlus,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Save,
  Trash2,
  Check,
  Plus,
  Search,
  Sliders,
  TrendingUp,
  Boxes,
  Percent,
  Upload,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  CheckSquare,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
} from '../../data/productCatalog';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api.js';
import hozriTshirtImg from '../../assets/home/hozri_tshirt.png';
import hozriInnerwearImg from '../../assets/home/hozri_innerwear.png';
import hozriSocksImg from '../../assets/home/hozri_socks.png';
import hozriHoodieImg from '../../assets/home/hozri_hoodie.png';
import elecHeadphonesImg from '../../assets/home/elec_headphones.png';
import elecApplianceImg from '../../assets/home/elec_appliance.png';
import elecLaptopImg from '../../assets/home/elec_laptop.png';
import elecPhoneImg from '../../assets/home/elec_phone.png';
import './ProductManagerView.css';

const PRESET_IMAGES = [
  { label: "Men's Combed Cotton T-Shirt (Hozri)", src: hozriTshirtImg },
  { label: 'Comfort Innerwear / Vest (Hozri)', src: hozriInnerwearImg },
  { label: 'Bamboo Hosiery Socks (Hozri)', src: hozriSocksImg },
  { label: 'Winter Fleeced Hoodie (Hozri)', src: hozriHoodieImg },
  { label: 'Smart Active Headphones (Electronics)', src: elecHeadphonesImg },
  { label: 'Multi-Cook Appliance (Electronics)', src: elecApplianceImg },
  { label: 'Ultra-Slim Pro Laptop (Electronics)', src: elecLaptopImg },
  { label: 'Pro 5G Smartphone (Electronics)', src: elecPhoneImg },
];

/**
 * Product & Pricing Management Center
 * Restricted to verified Administrators and explicitly authorized Business Center Owners.
 * Allows adding new products, updating distributor wholesale prices, MRP, and BV points.
 */
function ProductManagerView({ user, catalog = [], onUpdateCatalog, onNavigate }) {
  const { canManageProducts: authCanManage, isAdmin, isOwner } = useAuth();

  // Strict role and ownership verification from authenticated session
  const isAuthorized = Boolean(
    authCanManage ||
    isAdmin ||
    isOwner ||
    user?.isOwner === true ||
    user?.role?.toUpperCase() === 'ADMIN' ||
    user?.role?.toUpperCase() === 'SUPER_ADMIN'
  );

  const memberName = user?.name || user?.fullName || 'Business Center Owner';
  const memberId = user?.memberId || user?.distributorId || 'KV-1001';

  // Active Tab: 'add' (Add Product Form) | 'table' (Catalog & Price Manager)
  const [activeTab, setActiveTab] = useState('table');

  // Backend Database Table State
  const [productsList, setProductsList] = useState(catalog || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with prop when parent updates
  useEffect(() => {
    if (Array.isArray(catalog)) {
      setProductsList(catalog);
    }
  }, [catalog]);

  // Fetch products directly from backend database table
  const fetchProductsFromDb = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getProducts();
      if (Array.isArray(data)) {
        setProductsList(data);
        if (onUpdateCatalog) {
          onUpdateCatalog(data);
        }
      }
    } catch (err) {
      console.warn('[ProductManager] Failed to load products from database:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onUpdateCatalog]);

  useEffect(() => {
    fetchProductsFromDb();
    const handleUpdate = () => {
      fetchProductsFromDb();
    };
    window.addEventListener('kashvi_catalog_update', handleUpdate);
    return () => window.removeEventListener('kashvi_catalog_update', handleUpdate);
  }, [fetchProductsFromDb]);

  // Search & Filter in Table
  const [tableSearch, setTableSearch] = useState('');
  const [inlinePrices, setInlinePrices] = useState({});
  const [toastMsg, setToastMsg] = useState('');

  // Gallery Upload & Image Source State
  const [imageSourceMode, setImageSourceMode] = useState('gallery'); // 'gallery' | 'preset' | 'url'
  const [galleryImage, setGalleryImage] = useState(null); // { preview, name, size }
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const tableFileInputRef = useRef(null);
  const [targetProductForImg, setTargetProductForImg] = useState(null);

  // Checkbox Selection State for Bulk Actions
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  // Add Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Clothes & Hosiery (Hozri)',
    mrp: '0',
    distributorPrice: '0',
    volumeBV: '0',
    stock: 0,
    status: 'In Stock',
    servingSize: '',
    selectedPresetImg: PRESET_IMAGES[0].src,
    customImgUrl: '',
    uploadedGalleryImg: '',
    shortDesc: '',
    benefits: '',
    usage: '',
  });

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Checkbox Selection Handlers
  const handleToggleSelectOne = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleToggleSelectAll = () => {
    if (filteredCatalog.length === 0) return;
    const allFilteredIds = filteredCatalog.map((p) => p.id);
    const allSelected = allFilteredIds.every((id) => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // One-Click Bulk Deletion of Selected Items from Backend Database Table
  const handleDeleteSelected = async () => {
    if (selectedProductIds.length === 0) return;
    const count = selectedProductIds.length;
    const idsToDelete = [...selectedProductIds];
    const updated = productsList.filter((p) => !idsToDelete.includes(p.id));
    setProductsList(updated);
    if (onUpdateCatalog) onUpdateCatalog(updated);
    setSelectedProductIds([]);
    try {
      await api.bulkDeleteProducts(idsToDelete);
      showToast(`Deleted ${count} item(s) from database table.`);
    } catch (err) {
      console.warn('[ProductManager] Bulk delete remote failed:', err);
      showToast(`Error deleting items from database.`);
    }
  };

  // One-Click Deletion of ALL Items from Backend Database Table
  const handleDeleteAll = async () => {
    if (productsList.length === 0) {
      showToast('Catalog is already empty (0 items).');
      return;
    }
    if (window.confirm(`Delete all ${productsList.length} items from database tables? This will delete all products.`)) {
      const allIds = productsList.map((p) => p.id);
      setProductsList([]);
      if (onUpdateCatalog) onUpdateCatalog([]);
      setSelectedProductIds([]);
      try {
        await api.bulkDeleteProducts(allIds);
        showToast('All products deleted from database tables.');
      } catch (err) {
        console.warn('[ProductManager] Delete all remote failed:', err);
      }
    }
  };

  // Gallery File Selection Handler
  const handleGalleryFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const sizeStr =
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          : `${Math.round(file.size / 1024)} KB`;

      setGalleryImage({
        preview: dataUrl,
        name: file.name,
        size: sizeStr,
      });

      setNewProduct((prev) => ({
        ...prev,
        uploadedGalleryImg: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveGalleryImage = () => {
    setGalleryImage(null);
    setNewProduct((prev) => ({
      ...prev,
      uploadedGalleryImg: '',
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleGalleryFileSelect(file);
    }
  };

  // Existing Product Gallery Upload Handler (Table row)
  const handleExistingProductImgChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !targetProductForImg) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      const updatedCatalog = productsList.map((p) => {
        if (p.id === targetProductForImg.id) {
          return { ...p, image: dataUrl };
        }
        return p;
      });
      setProductsList(updatedCatalog);
      if (onUpdateCatalog) onUpdateCatalog(updatedCatalog);
      showToast(`Updated image for ${targetProductForImg.name}!`);

      try {
        await api.updateProduct(targetProductForImg.id, {
          image: dataUrl,
          imageUrl: dataUrl,
          images: [dataUrl],
        });
      } catch (err) {
        console.warn('[ProductManager] Image update failed:', err);
      }

      setTargetProductForImg(null);
    };
    reader.readAsDataURL(file);
  };

  // Profit Margin Auto-Calculation
  const calculatedMargin = useMemo(() => {
    const mrpNum = parseFloat(newProduct.mrp) || 0;
    const distNum = parseFloat(newProduct.distributorPrice) || 0;
    if (mrpNum > 0 && distNum > 0 && mrpNum >= distNum) {
      const marginRs = mrpNum - distNum;
      const marginPct = Math.round((marginRs / mrpNum) * 100);
      return { marginRs, marginPct };
    }
    return { marginRs: 0, marginPct: 0 };
  }, [newProduct.mrp, newProduct.distributorPrice]);

  // Analytics Metrics (Safely handles 0 data)
  const metrics = useMemo(() => {
    const totalProducts = productsList.length;
    const totalBV = productsList.reduce((acc, p) => acc + (p.volumeBV || p.bv || 0), 0);
    const totalInventoryValue = productsList.reduce(
      (acc, p) => acc + (p.distributorPrice || p.wholesalePrice || 0) * (p.stock !== undefined ? p.stock : (p.stockQuantity || 0)),
      0
    );
    const avgMargin = totalProducts === 0
      ? 0
      : Math.round(
        productsList.reduce((acc, p) => {
          const mrp = p.mrp || 0;
          const dist = p.distributorPrice || p.wholesalePrice || 0;
          if (mrp <= 0) return acc;
          const diff = mrp - dist;
          return acc + (diff / mrp) * 100;
        }, 0) / totalProducts
      );

    return { totalProducts, totalBV, totalInventoryValue, avgMargin };
  }, [productsList]);

  // Filtered catalog for table
  const filteredCatalog = useMemo(() => {
    if (!tableSearch.trim()) return productsList;
    const q = tableSearch.toLowerCase();
    return productsList.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.category && (typeof p.category === 'string' ? p.category : p.category.name).toLowerCase().includes(q)) ||
        (p.id && String(p.id).toLowerCase().includes(q)) ||
        (p.sku && String(p.sku).toLowerCase().includes(q))
    );
  }, [productsList, tableSearch]);

  // Submit New Product via Form directly to Database Table
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name.trim()) {
      alert('Please fill in product name.');
      return;
    }
    if (newProduct.distributorPrice === '' || isNaN(Number(newProduct.distributorPrice))) {
      alert('Please enter a valid distributor wholesale price.');
      return;
    }

    const mrpVal = newProduct.mrp !== '' ? (parseFloat(newProduct.mrp) || 0) : 0;
    const distVal = newProduct.distributorPrice !== '' ? (parseFloat(newProduct.distributorPrice) || 0) : 0;
    const bvVal = newProduct.volumeBV !== '' ? (parseFloat(newProduct.volumeBV) || 0) : 0;
    const stockVal = parseInt(newProduct.stock, 10) || 0;

    const benefitsArray = newProduct.benefits
      ? (Array.isArray(newProduct.benefits)
        ? newProduct.benefits
        : newProduct.benefits.split(',').map((s) => s.trim()).filter(Boolean))
      : ['Quality verified product formulation.'];

    const finalImage =
      (imageSourceMode === 'gallery' && newProduct.uploadedGalleryImg)
        ? newProduct.uploadedGalleryImg
        : (imageSourceMode === 'url' && newProduct.customImgUrl.trim())
          ? newProduct.customImgUrl.trim()
          : (newProduct.uploadedGalleryImg || newProduct.selectedPresetImg || '');

    let categoryId = 'clothes-hosiery';
    if (newProduct.category && newProduct.category.toLowerCase().includes('elec')) {
      categoryId = 'electronics-smart-devices';
    }

    const sku = `KV-${Date.now().toString().slice(-6)}`;

    const payload = {
      sku,
      name: newProduct.name.trim(),
      category: newProduct.category,
      categoryId,
      distributorPrice: distVal,
      wholesalePrice: distVal,
      mrp: mrpVal,
      bv: bvVal,
      volumeBv: bvVal,
      volumeBV: bvVal,
      stock: stockVal,
      stockQuantity: stockVal,
      status: newProduct.status === 'In Stock' || newProduct.status === 'Active' ? 'ACTIVE' : 'DRAFT',
      imageUrl: finalImage || undefined,
      images: finalImage ? [finalImage] : [],
      shortDesc: newProduct.shortDesc || undefined,
      description: newProduct.shortDesc || undefined,
      servingSize: newProduct.servingSize || undefined,
      sizeSpec: newProduct.servingSize || undefined,
      benefits: benefitsArray,
      usageInstructions: newProduct.usage || undefined,
      usage: newProduct.usage || undefined,
    };

    setIsSubmitting(true);
    try {
      const createdItem = await api.addProduct(payload);
      const itemToDisplay = createdItem || {
        ...payload,
        id: sku,
        image: finalImage,
      };

      const updated = [itemToDisplay, ...productsList.filter((p) => p.id !== itemToDisplay.id)];
      setProductsList(updated);
      if (onUpdateCatalog) {
        onUpdateCatalog(updated);
      }

      showToast(`Product "${payload.name}" saved to database successfully!`);
      setActiveTab('table');

      // Reset Form
      setNewProduct({
        name: '',
        category: 'Clothes & Hosiery (Hozri)',
        mrp: '0',
        distributorPrice: '0',
        volumeBV: '0',
        stock: 0,
        status: 'In Stock',
        servingSize: '',
        selectedPresetImg: PRESET_IMAGES[0].src,
        customImgUrl: '',
        uploadedGalleryImg: '',
        shortDesc: '',
        benefits: '',
        usage: '',
      });
      setGalleryImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await fetchProductsFromDb();
    } catch (err) {
      console.error('[ProductManager] Failed to add product to backend:', err);
      showToast(`Error adding product: ${err.message || 'Server error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline Price & BV Update
  const handleInlineChange = (productId, field, value) => {
    setInlinePrices((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  const handleSaveInlineUpdate = async (productId, overrideChanges = null) => {
    const changes = overrideChanges || inlinePrices[productId];
    if (!changes || Object.keys(changes).length === 0) return;

    const updatedCatalog = productsList.map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          distributorPrice:
            changes.distributorPrice !== undefined
              ? parseFloat(changes.distributorPrice)
              : p.distributorPrice,
          wholesalePrice:
            changes.distributorPrice !== undefined
              ? parseFloat(changes.distributorPrice)
              : (p.wholesalePrice || p.distributorPrice),
          mrp: changes.mrp !== undefined ? parseFloat(changes.mrp) : p.mrp,
          volumeBV: changes.volumeBV !== undefined ? parseFloat(changes.volumeBV) : p.volumeBV,
          bv: changes.volumeBV !== undefined ? parseFloat(changes.volumeBV) : (p.bv || p.volumeBV),
          stock: changes.stock !== undefined ? parseInt(changes.stock, 10) : p.stock,
          status: changes.status !== undefined ? changes.status : p.status,
        };
      }
      return p;
    });

    setProductsList(updatedCatalog);
    if (onUpdateCatalog) {
      onUpdateCatalog(updatedCatalog);
    }

    try {
      await api.updateProduct(productId, {
        distributorPrice: changes.distributorPrice !== undefined ? parseFloat(changes.distributorPrice) : undefined,
        wholesalePrice: changes.distributorPrice !== undefined ? parseFloat(changes.distributorPrice) : undefined,
        mrp: changes.mrp !== undefined ? parseFloat(changes.mrp) : undefined,
        bv: changes.volumeBV !== undefined ? parseFloat(changes.volumeBV) : undefined,
        volumeBV: changes.volumeBV !== undefined ? parseFloat(changes.volumeBV) : undefined,
        stock: changes.stock !== undefined ? parseInt(changes.stock, 10) : undefined,
        status: changes.status !== undefined ? changes.status : undefined,
      });
      showToast(`Updated product in database!`);
    } catch (err) {
      console.warn('[ProductManager] Remote updateProduct error:', err);
      showToast(`Failed to update product in database.`);
    }

    // Clear inline tracking for this row
    setInlinePrices((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  // Delete product from database table
  const handleDeleteProduct = async (productId, productName) => {
    if (confirm(`Are you sure you want to remove "${productName}" from the database table?`)) {
      const updatedCatalog = productsList.filter((p) => p.id !== productId);
      setProductsList(updatedCatalog);
      if (onUpdateCatalog) {
        onUpdateCatalog(updatedCatalog);
      }
      try {
        await api.deleteProduct(productId);
        showToast(`Removed "${productName}" from database.`);
      } catch (err) {
        console.warn('[ProductManager] Remote deleteProduct error:', err);
        showToast(`Failed to delete product from database.`);
      }
    }
  };

  // IF ACCESS IS DENIED (NON-ADMIN / NON-OWNER)
  if (!isAuthorized) {
    return (
      <div className="pm-container">
        <div className="pm-access-denied-card">
          <ShieldAlert size={56} className="denied-icon" />
          <h2 className="denied-title">403 — Access Denied</h2>
          <p className="denied-desc">
            Product catalog modification, wholesale price adjustments, BV configuration, and new product creation are
            strictly reserved for authorized administrators and explicitly verified business center owners. Regular distributors and sponsored users cannot access this area.
          </p>
          <div className="denied-action">
            <button
              type="button"
              className="btn-pm-back"
              onClick={() => onNavigate ? onNavigate('dashboard') : window.location.assign('/dashboard')}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-container">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="pm-toast-banner">
          <Check size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Verified ID Owner Security Clearance Header */}
      <div className="pm-security-banner">
        <div className="pm-security-left">
          <div className="security-badge-shield">
            <ShieldCheck size={18} />
            <span>ID OWNER SECURITY CLEARANCE VERIFIED</span>
          </div>
          <h1 className="pm-main-title">Product &amp; Pricing Management Center</h1>
          <p className="pm-main-desc">
            Authorized session for <strong>{memberName}</strong> (Owner ID: <strong>{memberId}</strong>).
            Add new products, configure wholesale distributor pricing, set Commission Volume Points (BV),
            and manage active inventory. All updates sync in real time with the Distributor Shop.
          </p>
        </div>

        <div className="pm-owner-badge-box">
          <div className="owner-avatar-circle">
            <span>ID</span>
          </div>
          <div className="owner-meta-info">
            <span className="owner-role-title">Business Center Owner</span>
            <strong className="owner-name-title">{memberName}</strong>
            <span className="owner-id-code">ID: {memberId}</span>
          </div>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="pm-metrics-row">
        <div className="pm-metric-card">
          <div className="metric-icon-wrap bg-blue">
            <Boxes size={20} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Total Active Products</span>
            <strong className="metric-value">{metrics.totalProducts} Items</strong>
          </div>
        </div>

        <div className="pm-metric-card">
          <div className="metric-icon-wrap bg-teal">
            <Layers size={20} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Total Catalog BV Points</span>
            <strong className="metric-value">+{metrics.totalBV} BV</strong>
          </div>
        </div>

        <div className="pm-metric-card">
          <div className="metric-icon-wrap bg-green">
            <Percent size={20} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Average Profit Margin</span>
            <strong className="metric-value">{metrics.avgMargin}% Profit</strong>
          </div>
        </div>

        <div className="pm-metric-card">
          <div className="metric-icon-wrap bg-orange">
            <TrendingUp size={20} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Inventory Valuation</span>
            <strong className="metric-value">
              ₹{metrics.totalInventoryValue.toLocaleString('en-IN')}
            </strong>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="pm-tabs-bar">
        <button
          type="button"
          className={`pm-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          <Sliders size={16} />
          <span>Catalog &amp; Price Controller ({productsList.length})</span>
        </button>

        <button
          type="button"
          className={`pm-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <Plus size={16} />
          <span>Add New Product</span>
        </button>
      </div>

      {/* TAB 1: ADD NEW PRODUCT FORM */}
      {activeTab === 'add' && (
        <div className="pm-add-card">
          <div className="pm-card-header">
            <PackagePlus size={22} className="card-header-icon" />
            <div>
              <h3 className="card-title">Add Product to Database Table</h3>
              <p className="card-subtitle">
                Fill the form below to publish a new product directly into the database tables. Set wholesale distributor price,
                MRP, and binary commission volume (BV).
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateProduct} className="pm-form-body">
            {/* Section 1: Basic Details */}
            <h4 className="form-section-heading">1. Product Identity &amp; Classification</h4>
            <div className="pm-fields-grid three-cols">
              <div className="pm-form-group">
                <label className="field-label">
                  Product Name / Title <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Combed Cotton Hosiery T-Shirt or Smart Watch"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="pm-input"
                />
              </div>

              <div className="pm-form-group">
                <label className="field-label">Category <span className="req">*</span></label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="pm-select"
                >
                  {PRODUCT_CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pm-form-group">
                <label className="field-label">Serving Size / Package</label>
                <input
                  type="text"
                  placeholder="e.g. Size M-XXL / Pack of 3 / 100W Appliance"
                  value={newProduct.servingSize}
                  onChange={(e) => setNewProduct({ ...newProduct, servingSize: e.target.value })}
                  className="pm-input"
                />
              </div>
            </div>

            {/* Section 2: Pricing & Volume Points (The Core Request) */}
            <h4 className="form-section-heading" style={{ marginTop: '24px' }}>
              2. Price Structure &amp; Commission Volume Points (BV)
            </h4>
            <div className="pm-fields-grid four-cols">
              <div className="pm-form-group">
                <label className="field-label">
                  Distributor Wholesale Price (₹) <span className="req">*</span>
                </label>
                <div className="input-prefix-wrap">
                  <span className="input-prefix">₹</span>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0"
                    value={newProduct.distributorPrice}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, distributorPrice: e.target.value })
                    }
                    className="pm-input with-prefix"
                  />
                </div>
                <span className="field-hint">Cost paid by Brand Partners</span>
              </div>

              <div className="pm-form-group">
                <label className="field-label">Maximum Retail Price (MRP ₹)</label>
                <div className="input-prefix-wrap">
                  <span className="input-prefix">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newProduct.mrp}
                    onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })}
                    className="pm-input with-prefix"
                  />
                </div>
                <span className="field-hint">Public retail catalog price</span>
              </div>

              <div className="pm-form-group">
                <label className="field-label">
                  Volume Points (CVP / BV) <span className="req">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="0"
                  value={newProduct.volumeBV}
                  onChange={(e) => setNewProduct({ ...newProduct, volumeBV: e.target.value })}
                  className="pm-input"
                />
                <span className="field-hint">Credits toward weekly commission</span>
              </div>

              <div className="pm-form-group">
                <label className="field-label">Initial Warehouse Stock</label>
                <input
                  type="number"
                  min="0"
                  placeholder="250"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  className="pm-input"
                />
                <span className="field-hint">Units available</span>
              </div>
            </div>

            {/* Profit Margin Preview Bar */}
            {calculatedMargin.marginRs > 0 && (
              <div className="pm-margin-preview-banner">
                <div className="margin-col">
                  <span>Retail Profit per Unit:</span>
                  <strong>₹{calculatedMargin.marginRs.toLocaleString('en-IN')}</strong>
                </div>
                <div className="margin-col">
                  <span>Distributor Profit Margin:</span>
                  <strong className="text-green font-bold">{calculatedMargin.marginPct}% Markup</strong>
                </div>
                <div className="margin-col">
                  <span>Binary Volume:</span>
                  <strong className="text-teal font-bold">
                    +{newProduct.volumeBV || 0} BV per Order
                  </strong>
                </div>
              </div>
            )}

            {/* Section 3: Product Imagery (with Gallery Upload) */}
            <h4 className="form-section-heading" style={{ marginTop: '24px' }}>
              3. Product Imagery
            </h4>

            {/* Source Switcher: Gallery Upload vs Presets vs Web URL */}
            <div className="image-source-tabs">
              <button
                type="button"
                className={`img-tab-btn ${imageSourceMode === 'gallery' ? 'active' : ''}`}
                onClick={() => setImageSourceMode('gallery')}
              >
                <Upload size={15} />
                <span>Upload from Gallery / Photos</span>
              </button>

              <button
                type="button"
                className={`img-tab-btn ${imageSourceMode === 'preset' ? 'active' : ''}`}
                onClick={() => setImageSourceMode('preset')}
              >
                <ImageIcon size={15} />
                <span>Choose from Product Presets</span>
              </button>

              <button
                type="button"
                className={`img-tab-btn ${imageSourceMode === 'url' ? 'active' : ''}`}
                onClick={() => setImageSourceMode('url')}
              >
                <span>Web Image URL</span>
              </button>
            </div>

            {/* OPTION 1: GALLERY FILE UPLOAD */}
            {imageSourceMode === 'gallery' && (
              <div className="gallery-upload-container">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => handleGalleryFileSelect(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />

                {!galleryImage ? (
                  <div
                    className={`gallery-dropzone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="dropzone-icon-circle">
                      <Camera size={26} />
                    </div>
                    <div className="dropzone-text-group">
                      <strong className="dropzone-title">Click to Upload from Gallery or Device</strong>
                      <p className="dropzone-desc">
                        Drag and drop product photos here, or click to browse files from your computer or phone gallery.
                      </p>
                      <span className="dropzone-support">Supports PNG, JPG, JPEG, WEBP up to 10MB</span>
                    </div>
                    <button
                      type="button"
                      className="btn-browse-gallery"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload size={15} />
                      <span>Browse Gallery</span>
                    </button>
                  </div>
                ) : (
                  <div className="gallery-preview-card">
                    <div className="preview-img-wrapper">
                      <img src={galleryImage.preview} alt="Gallery Preview" />
                    </div>
                    <div className="preview-meta-info">
                      <div className="preview-status-badge">
                        <CheckCircle2 size={14} />
                        <span>Gallery Photo Ready to Publish</span>
                      </div>
                      <strong className="preview-filename">{galleryImage.name}</strong>
                      <span className="preview-filesize">File Size: {galleryImage.size}</span>
                      <div className="preview-actions-row">
                        <button
                          type="button"
                          className="btn-replace-img"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={14} />
                          <span>Change Photo</span>
                        </button>
                        <button
                          type="button"
                          className="btn-remove-img"
                          onClick={handleRemoveGalleryImage}
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OPTION 2: PRESET IMAGES PICKER */}
            {imageSourceMode === 'preset' && (
              <div className="preset-images-picker">
                <label className="field-label">Select High-Res Image Asset:</label>
                <div className="preset-thumbs-grid">
                  {PRESET_IMAGES.map((img, idx) => (
                    <div
                      key={idx}
                      className={`preset-thumb-card ${newProduct.selectedPresetImg === img.src && !newProduct.uploadedGalleryImg && !newProduct.customImgUrl
                          ? 'selected'
                          : ''
                        }`}
                      onClick={() =>
                        setNewProduct({
                          ...newProduct,
                          selectedPresetImg: img.src,
                          customImgUrl: '',
                          uploadedGalleryImg: '',
                        })
                      }
                    >
                      <img src={img.src} alt={img.label} />
                      <span className="preset-caption">{img.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OPTION 3: CUSTOM URL */}
            {imageSourceMode === 'url' && (
              <div className="custom-url-row" style={{ marginTop: '10px' }}>
                <label className="field-label">Or Custom Image URL:</label>
                <input
                  type="url"
                  placeholder="https://example.com/product-image.jpg"
                  value={newProduct.customImgUrl}
                  onChange={(e) => setNewProduct({ ...newProduct, customImgUrl: e.target.value })}
                  className="pm-input"
                />
              </div>
            )}

            {/* Section 4: Descriptions & Benefits */}
            <h4 className="form-section-heading" style={{ marginTop: '24px' }}>
              4. Product Description &amp; Specifications
            </h4>
            <div className="pm-fields-grid two-cols">
              <div className="pm-form-group">
                <label className="field-label">Short Description</label>
                <textarea
                  rows="3"
                  placeholder="Brief synopsis highlighting key product features and fabric/build quality..."
                  value={newProduct.shortDesc}
                  onChange={(e) => setNewProduct({ ...newProduct, shortDesc: e.target.value })}
                  className="pm-textarea"
                />
              </div>

              <div className="pm-form-group">
                <label className="field-label">
                  Key Highlights &amp; Features (comma-separated bullet points)
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. 100% Breathable cotton, Bio-washed anti-shrink finish, Moisture absorbent"
                  value={newProduct.benefits}
                  onChange={(e) => setNewProduct({ ...newProduct, benefits: e.target.value })}
                  className="pm-textarea"
                />
              </div>

              <div className="pm-form-group full-width">
                <label className="field-label">Care Instructions / Specifications</label>
                <input
                  type="text"
                  placeholder="e.g. Machine wash cold with like colors / Connect to 220V AC wall socket."
                  value={newProduct.usage}
                  onChange={(e) => setNewProduct({ ...newProduct, usage: e.target.value })}
                  className="pm-input"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="pm-form-footer">
              <button
                type="button"
                className="btn-pm-cancel"
                onClick={() => setActiveTab('table')}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-pm-publish"
                disabled={isSubmitting}
              >
                <PackagePlus size={18} />
                <span>{isSubmitting ? 'Saving to Database...' : 'Save Product to Database'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: LIVE CATALOG & PRICE CONTROLLER TABLE */}
      {activeTab === 'table' && (
        <div className="pm-table-card">
          <div className="pm-table-top-controls">
            <div className="pm-search-input-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search catalog by name, category, or code..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pm-search-input"
              />
            </div>

            <div className="pm-top-action-buttons">
              <button
                type="button"
                className="btn-pm-delete-all"
                onClick={handleDeleteAll}
                title="Delete all catalog items from database tables"
              >
                <Trash2 size={15} />
                <span>Delete All</span>
              </button>

              <button
                type="button"
                className="btn-pm-add-shortcut"
                onClick={() => setActiveTab('add')}
              >
                <Plus size={16} />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Bulk Action Bar for Selected Checkboxes */}
          {selectedProductIds.length > 0 && (
            <div className="pm-bulk-action-bar">
              <div className="bulk-selection-info">
                <CheckSquare size={16} className="bulk-check-icon" />
                <span>
                  <strong>{selectedProductIds.length}</strong> of {filteredCatalog.length} item(s) selected
                </span>
              </div>
              <div className="bulk-buttons-group">
                <button
                  type="button"
                  className="btn-bulk-delete"
                  onClick={handleDeleteSelected}
                  title="Delete all selected items at one click"
                >
                  <Trash2 size={15} />
                  <span>
                    {selectedProductIds.length === productsList.length
                      ? `Delete All (${productsList.length} items)`
                      : `Delete Selected (${selectedProductIds.length})`}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn-bulk-deselect"
                  onClick={() => setSelectedProductIds([])}
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          <div className="pm-table-container">
            {isLoading && productsList.length === 0 ? (
              <div className="pm-empty-catalog-state">
                <div className="empty-icon-circle">
                  <Boxes size={44} />
                </div>
                <h3 className="empty-title">Loading Products from Database...</h3>
                <p className="empty-desc">
                  Connecting to backend database tables and loading live product data.
                </p>
              </div>
            ) : productsList.length === 0 ? (
              <div className="pm-empty-catalog-state">
                <div className="empty-icon-circle">
                  <Boxes size={44} />
                </div>
                <h3 className="empty-title">Database Table is Empty (0 Products)</h3>
                <p className="empty-desc">
                  No products are currently found in the database. Use the form to add products directly to the database tables.
                </p>
                <div className="empty-state-buttons">
                  <button
                    type="button"
                    className="btn-empty-add-product"
                    onClick={() => setActiveTab('add')}
                  >
                    <Plus size={16} />
                    <span>+ Add Product Using Form</span>
                  </button>
                </div>
              </div>
            ) : (
              <table className="pm-catalog-table">
                <thead>
                  <tr>
                    <th className="th-checkbox">
                      <input
                        type="checkbox"
                        checked={
                          filteredCatalog.length > 0 &&
                          filteredCatalog.every((p) => selectedProductIds.includes(p.id))
                        }
                        onChange={handleToggleSelectAll}
                        title={
                          filteredCatalog.length > 0 &&
                            filteredCatalog.every((p) => selectedProductIds.includes(p.id))
                            ? 'Deselect All Items'
                            : 'Select All Items'
                        }
                      />
                    </th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Wholesale Price (₹)</th>
                    <th>MRP (₹)</th>
                    <th>Volume (BV)</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((product) => {
                    const inline = inlinePrices[product.id] || {};
                    const isModified = Object.keys(inline).length > 0;
                    const isSelected = selectedProductIds.includes(product.id);

                    return (
                      <tr
                        key={product.id}
                        className={`${isModified ? 'row-modified' : ''} ${isSelected ? 'row-selected' : ''
                          }`}
                      >
                        {/* Checkbox */}
                        <td className="td-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(product.id)}
                          />
                        </td>

                        {/* Product Name & Image */}
                        <td>
                          <div className="table-product-cell">
                            <div className="product-cell-thumb">
                              {product.image ? (
                                <img src={product.image} alt={product.name} />
                              ) : (
                                <span>{product.name.slice(0, 2)}</span>
                              )}
                              <button
                                type="button"
                                className="btn-table-upload-img"
                                title="Update product photo from gallery / device"
                                onClick={() => {
                                  setTargetProductForImg(product);
                                  if (tableFileInputRef.current) {
                                    tableFileInputRef.current.value = '';
                                    tableFileInputRef.current.click();
                                  }
                                }}
                              >
                                <Camera size={11} />
                              </button>
                            </div>
                            <div>
                              <strong className="table-product-name">{product.name}</strong>
                              <span className="table-product-sku">{product.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td>
                          <span className="table-cat-badge">{product.category}</span>
                        </td>

                        {/* Distributor Wholesale Price (Editable) */}
                        <td>
                          <div className="inline-price-input-wrap">
                            <span className="inline-curr">₹</span>
                            <input
                              type="number"
                              value={
                                inline.distributorPrice !== undefined
                                  ? inline.distributorPrice
                                  : product.distributorPrice
                              }
                              onChange={(e) =>
                                handleInlineChange(product.id, 'distributorPrice', e.target.value)
                              }
                              onBlur={() => handleSaveInlineUpdate(product.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                              className="inline-price-input highlight"
                            />
                          </div>
                        </td>

                        {/* MRP Price (Editable) */}
                        <td>
                          <div className="inline-price-input-wrap">
                            <span className="inline-curr">₹</span>
                            <input
                              type="number"
                              value={inline.mrp !== undefined ? inline.mrp : product.mrp}
                              onChange={(e) =>
                                handleInlineChange(product.id, 'mrp', e.target.value)
                              }
                              onBlur={() => handleSaveInlineUpdate(product.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                              className="inline-price-input"
                            />
                          </div>
                        </td>

                        {/* BV Points (Editable) */}
                        <td>
                          <div className="inline-price-input-wrap bv">
                            <input
                              type="number"
                              value={
                                inline.volumeBV !== undefined ? inline.volumeBV : product.volumeBV
                              }
                              onChange={(e) =>
                                handleInlineChange(product.id, 'volumeBV', e.target.value)
                              }
                              onBlur={() => handleSaveInlineUpdate(product.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                              className="inline-price-input bv-input"
                            />
                            <span className="inline-bv-label">BV</span>
                          </div>
                        </td>

                        {/* Stock (Editable) */}
                        <td>
                          <input
                            type="number"
                            value={inline.stock !== undefined ? inline.stock : product.stock}
                            onChange={(e) =>
                              handleInlineChange(product.id, 'stock', e.target.value)
                            }
                            onBlur={() => handleSaveInlineUpdate(product.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className="inline-stock-input"
                          />
                        </td>

                        {/* Status */}
                        <td>
                          <select
                            value={inline.status !== undefined ? inline.status : product.status || 'Pending Pricing'}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              handleInlineChange(product.id, 'status', newStatus);
                              handleSaveInlineUpdate(product.id, { ...inline, status: newStatus });
                            }}
                            className="inline-status-select"
                          >
                            <option value="Pending Pricing">Pending Pricing</option>
                            <option value="In Stock">In Stock</option>
                            <option value="Low Stock">Low Stock</option>
                            <option value="Out of Stock">Out of Stock</option>
                          </select>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="table-actions-cell">
                            {isModified && (
                              <button
                                type="button"
                                className="btn-save-inline"
                                onClick={() => handleSaveInlineUpdate(product.id)}
                                title="Save updated price and details"
                              >
                                <Save size={14} />
                                <span>Save</span>
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn-delete-product"
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                              title="Remove from store"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Input for Updating Existing Product Image */}
      <input
        type="file"
        ref={tableFileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleExistingProductImgChange}
      />
    </div>
  );
}

export default ProductManagerView;
