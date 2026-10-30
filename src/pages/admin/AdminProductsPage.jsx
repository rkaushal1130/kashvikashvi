import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import ProductManagerView from '../../components/dashboard/ProductManagerView.jsx';
import { api } from '../../services/api.js';

export function AdminProductsPage() {
  const { currentUser } = useAuth();
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const data = await api.getProducts();
        if (isMounted && Array.isArray(data)) {
          setCatalog(data);
        }
      } catch (err) {
        console.error('Failed to load catalog for AdminProductsPage:', err);
      }
    }
    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="admin-page-container">
      <ProductManagerView
        user={currentUser}
        catalog={catalog}
        onUpdateCatalog={setCatalog}
      />
    </div>
  );
}

export default AdminProductsPage;
