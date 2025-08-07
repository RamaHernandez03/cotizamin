"use client";

import { useEffect, useState } from "react";

interface Producto {
  id_producto: string;
  codigo_interno: string;
  descripcion: string;
  marca: string;
  modelo: string;
  material: string;
  norma_tecnica: string;
  unidad: string;
  stock_actual: number;
  precio_actual: number;
  moneda: string;
  tiempo_entrega: string;
  ubicacion_stock: string;
  estado: string;
  fecha_actualizacion: string;
}

interface UploadResponse {
  message: string;
  procesados?: number;
  errores?: string[];
}

export default function InventoryPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  
  // Estados para edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Producto>>({});
  const [saving, setSaving] = useState(false);

  const fetchProductos = async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setProductos(data);
      setFilteredProductos(data);
    } catch (error) {
      console.error("Error fetching productos:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setUploadMessage(`Error al cargar productos: ${errorMessage}`);
    }
  };

  // Filtrar productos
  useEffect(() => {
    let filtered = productos.filter(producto => {
      const matchesSearch = searchTerm === "" || 
        producto.codigo_interno.toLowerCase().includes(searchTerm.toLowerCase()) ||
        producto.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        producto.marca.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || producto.estado === statusFilter;
      
      const matchesStock = stockFilter === "all" ||
        (stockFilter === "in_stock" && producto.stock_actual > 0) ||
        (stockFilter === "low_stock" && producto.stock_actual > 0 && producto.stock_actual < 10) ||
        (stockFilter === "out_of_stock" && producto.stock_actual === 0);
      
      return matchesSearch && matchesStatus && matchesStock;
    });
    
    setFilteredProductos(filtered);
    setCurrentPage(1);
  }, [productos, searchTerm, statusFilter, stockFilter]);

  // Paginación
  const totalPages = Math.ceil(filteredProductos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredProductos.slice(startIndex, startIndex + itemsPerPage);

  const uploadFile = async () => {
    if (!file) return;
    
    setLoading(true);
    setUploadMessage("");
    setUploadErrors([]);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/products", {
        method: "POST",
        body: formData,
      });

      const data: UploadResponse = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Error al subir archivo");
      }

      setUploadMessage(data.message);
      if (data.errores && data.errores.length > 0) {
        setUploadErrors(data.errores);
      }
      
      await fetchProductos();
      setFile(null);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error("Error uploading file:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setUploadMessage(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPlantilla = () => {
    window.location.href = "/api/products/template";
  };

  // Funciones de edición
  const startEditing = (producto: Producto) => {
    setEditingId(producto.id_producto);
    setEditingData(producto);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({});
  };

  const saveProduct = async () => {
    if (!editingId || !editingData) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingData),
      });

      if (!res.ok) {
        throw new Error("Error al guardar producto");
      }

      await fetchProductos();
      setEditingId(null);
      setEditingData({});
      setUploadMessage("Producto actualizado correctamente");
    } catch (error) {
      console.error("Error saving product:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setUploadMessage(`Error: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string, codigo: string) => {
    if (!confirm(`¿Estás seguro de eliminar el producto ${codigo}?`)) return;
    
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Error al eliminar producto");
      }

      await fetchProductos();
      setUploadMessage("Producto eliminado correctamente");
    } catch (error) {
      console.error("Error deleting product:", error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setUploadMessage(`Error: ${errorMessage}`);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  return (
    <div className="p-6" style={{minHeight: '100vh'}}>
      <h1 className="text-3xl font-bold mb-6" style={{color: '#00152F'}}>Inventario</h1>

      {/* Controles de carga */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <button 
            onClick={downloadPlantilla} 
            className="text-white px-6 py-3 rounded-lg transition-all duration-200 font-semibold hover:opacity-90 shadow-md"
            style={{backgroundColor: '#00152F'}}
          >
            📥 Descargar plantilla Excel
          </button>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border-2 rounded-lg px-4 py-3 bg-white shadow-sm"
            style={{borderColor: '#00152F', color:'#00152F' }}
          />
          
          <button
            onClick={uploadFile}
            disabled={!file || loading}
            className={`px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-md ${
              !file || loading
                ? "opacity-50 cursor-not-allowed"
                : "hover:opacity-90"
            } text-black`}
            style={{backgroundColor: !file || loading ? '#ccc' : '#FFBD00'}}
          >
            {loading ? "⏳ Subiendo..." : "📤 Subir Excel"}
          </button>
        </div>

        {/* Mensajes de resultado */}
        {uploadMessage && (
          <div className={`p-4 rounded-lg shadow-sm ${
            uploadMessage.includes("Error") 
              ? "bg-red-50 border-2 border-red-200"
              : "bg-green-50 border-2 border-green-200"
          }`} style={{color: uploadMessage.includes("Error") ? '#dc2626' : '#059669'}}>
            {uploadMessage}
            <button 
              onClick={() => setUploadMessage("")}
              className="ml-3 text-sm underline hover:no-underline"
            >
              ✕
            </button>
          </div>
        )}

        {/* Errores específicos */}
        {uploadErrors.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg shadow-sm">
            <h4 className="font-bold mb-2" style={{color: '#ea580c'}}>Advertencias:</h4>
            <ul className="list-disc list-inside text-sm max-h-32 overflow-y-auto" style={{color: '#c2410c'}}>
              {uploadErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Filtros y búsqueda */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Buscar por código, descripción o marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-2 rounded-lg px-4 py-3 min-w-64 bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{borderColor: '#00152F', color:'#00152F' ,'--tw-ring-color': '#FFBD00'} as any}
          />
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-2 rounded-lg px-4 py-3 bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{borderColor: '#00152F', color:'#00152F', '--tw-ring-color': '#FFBD00'} as any}
          >
            <option value="all">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
          
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="border-2 rounded-lg px-4 py-3 bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{borderColor: '#00152F', color:'#00152F', '--tw-ring-color': '#FFBD00'} as any}
          >
            <option value="all">Todo el stock</option>
            <option value="in_stock">Con stock</option>
            <option value="low_stock">Stock bajo (&lt;10)</option>
            <option value="out_of_stock">Sin stock</option>
          </select>

          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="border-2 rounded-lg px-4 py-3 bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{borderColor: '#00152F', color:'#00152F' ,'--tw-ring-color': '#FFBD00'} as any}
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
            <option value={200}>200 por página</option>
          </select>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="p-4 rounded-lg shadow-md text-white" style={{backgroundColor: '#00152F'}}>
          <span className="font-semibold text-lg">
            Total: {productos.length}
          </span>
        </div>
        <div className="p-4 rounded-lg shadow-md" style={{backgroundColor: '#FFBD00', color: '#00152F'}}>
          <span className="font-semibold text-lg">
            Filtrados: {filteredProductos.length}
          </span>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow-md border-2 border-green-200">
          <span className="font-semibold text-lg text-green-800">
            Con stock: {productos.filter(p => p.stock_actual > 0).length}
          </span>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg shadow-md border-2 border-orange-200">
          <span className="font-semibold text-lg text-orange-800">
            Stock bajo: {productos.filter(p => p.stock_actual > 0 && p.stock_actual < 10).length}
          </span>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow-md border-2 border-red-200">
          <span className="font-semibold text-lg text-red-800">
            Sin stock: {productos.filter(p => p.stock_actual === 0).length}
          </span>
        </div>
      </div>

      {/* Paginación superior */}
      {totalPages > 1 && (
        <div className="mb-6 flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
          <div className="text-sm font-medium" style={{color: '#00152F'}}>
            Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredProductos.length)} de {filteredProductos.length} productos
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm"
              style={{backgroundColor: currentPage === 1 ? '#ccc' : '#00152F'}}
            >
              ← Anterior
            </button>
            <span className="text-sm font-medium" style={{color: '#00152F'}}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm"
              style={{backgroundColor: currentPage === totalPages ? '#ccc' : '#00152F'}}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Tabla de productos */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
        <table className="min-w-full table-auto">
          <thead className="text-white sticky top-0" style={{backgroundColor: '#00152F'}}>
            <tr>
              <th className="px-4 py-4 text-left font-semibold">Código</th>
              <th className="px-4 py-4 text-left font-semibold">Descripción</th>
              <th className="px-4 py-4 text-left font-semibold">Marca</th>
              <th className="px-4 py-4 text-left font-semibold">Modelo</th>
              <th className="px-4 py-4 text-right font-semibold">Stock</th>
              <th className="px-4 py-4 text-right font-semibold">Precio (USD)</th>
              <th className="px-4 py-4 text-left font-semibold">Ubicación</th>
              <th className="px-4 py-4 text-center font-semibold">Estado</th>
              <th className="px-4 py-4 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center" style={{color: '#00152F'}}>
                  <div className="text-lg font-medium">
                    {productos.length === 0 
                      ? "No hay productos cargados. Descarga la plantilla y sube tu primer archivo Excel."
                      : "No se encontraron productos con los filtros aplicados."
                    }
                  </div>
                </td>
              </tr>
            ) : (
              currentProducts.map((prod, index) => (
                <tr key={prod.id_producto} className={`text-sm transition-colors duration-150 border-b border-gray-100 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } hover:bg-gray-100`}>
                  <td className="px-4 py-3 font-mono font-medium" style={{color: '#00152F'}}>{prod.codigo_interno}</td>
                  
                  <td className="px-4 py-3">
                    {editingId === prod.id_producto ? (
                      <input
                        type="text"
                        value={editingData.descripcion || ''}
                        onChange={(e) => setEditingData({...editingData, descripcion: e.target.value})}
                        className="w-full px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{borderColor: '#00152F', '--tw-ring-color': '#FFBD00'} as any}
                      />
                    ) : (
                      <span title={prod.descripcion} style={{color: '#00152F'}}>
                        {prod.descripcion.length > 40 
                          ? `${prod.descripcion.substring(0, 40)}...`
                          : prod.descripcion
                        }
                      </span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3" style={{color: '#00152F'}}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="text"
                        value={editingData.marca || ''}
                        onChange={(e) => setEditingData({...editingData, marca: e.target.value})}
                        className="w-full px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{borderColor: '#00152F', '--tw-ring-color': '#FFBD00'} as any}
                      />
                    ) : prod.marca}
                  </td>
                  
                  <td className="px-4 py-3" style={{color: '#00152F'}}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="text"
                        value={editingData.modelo || ''}
                        onChange={(e) => setEditingData({...editingData, modelo: e.target.value})}
                        className="w-full px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{borderColor: '#00152F', '--tw-ring-color': '#FFBD00'} as any}
                      />
                    ) : prod.modelo}
                  </td>
                  
                  <td className={`px-4 py-3 text-right font-bold ${
                    prod.stock_actual === 0 ? 'text-red-600' : 
                    prod.stock_actual < 10 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="number"
                        value={editingData.stock_actual || 0}
                        onChange={(e) => setEditingData({...editingData, stock_actual: parseInt(e.target.value) || 0})}
                        className="w-20 px-2 py-1 text-xs border-2 rounded text-right focus:outline-none focus:ring-1"
                        style={{borderColor: '#00152F', '--tw-ring-color': '#FFBD00'} as any}
                      />
                    ) : prod.stock_actual}
                  </td>
                  
                  <td className="px-4 py-3 text-right font-mono font-medium" style={{color: '#00152F'}}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editingData.precio_actual || 0}
                        onChange={(e) => setEditingData({...editingData, precio_actual: parseFloat(e.target.value) || 0})}
                        className="w-24 px-2 py-1 text-xs border-2 rounded text-right focus:outline-none focus:ring-1"
                        style={{borderColor: '#00152F', '--tw-ring-color': '#FFBD00'} as any}
                      />
                    ) : `$${prod.precio_actual.toFixed(2)}`}
                  </td>
                  
                  <td className="px-4 py-3" style={{color: '#00152F'}}>
                    {editingId === prod.id_producto ? (
                      <input
                        type="text"
                        value={editingData.ubicacion_stock || ''}
                        onChange={(e) => setEditingData({...editingData, ubicacion_stock: e.target.value})}
                        className="w-full px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{borderColor: '#00152F', '--tw-ring-color': '#FFBD00'} as any}
                      />
                    ) : prod.ubicacion_stock}
                  </td>
                  
                  <td className="px-4 py-3 text-center">
                    {editingId === prod.id_producto ? (
                      <select
                        value={editingData.estado || 'Activo'}
                        onChange={(e) => setEditingData({...editingData, estado: e.target.value})}
                        className="px-2 py-1 text-xs border-2 rounded focus:outline-none focus:ring-1"
                        style={{borderColor: '#00152F', '--tw-ring-color': '#FFBD00'} as any}
                      >
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        prod.estado === 'Activo' 
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {prod.estado}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 text-center">
                    {editingId === prod.id_producto ? (
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={saveProduct}
                          disabled={saving}
                          className="text-white px-3 py-2 rounded-lg text-xs font-medium transition-opacity duration-200 disabled:opacity-50 shadow-sm"
                          style={{backgroundColor: '#00152F'}}
                        >
                          {saving ? '⏳' : '✓ Guardar'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-opacity duration-200 shadow-sm text-black"
                          style={{backgroundColor: '#FFBD00'}}
                        >
                          ✕ Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => startEditing(prod)}
                          className="text-white px-3 py-2 rounded-lg text-xs font-medium transition-opacity duration-200 hover:opacity-90 shadow-sm"
                          style={{backgroundColor: '#00152F'}}
                          title="Editar"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => deleteProduct(prod.id_producto, prod.codigo_interno)}
                          className="bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200 hover:bg-red-700 shadow-sm"
                          title="Eliminar"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación inferior */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
          <div className="text-sm font-medium" style={{color: '#00152F'}}>
            Total: {filteredProductos.length} productos
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm"
              style={{backgroundColor: currentPage === 1 ? '#ccc' : '#00152F'}}
            >
              « Primera
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm"
              style={{backgroundColor: currentPage === 1 ? '#ccc' : '#00152F'}}
            >
              ‹ Anterior
            </button>
            
            {/* Páginas numeradas */}
            {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-sm ${
                    currentPage === pageNum 
                      ? 'text-black' 
                      : 'text-white hover:opacity-90'
                  }`}
                  style={{
                    backgroundColor: currentPage === pageNum ? '#FFBD00' : '#00152F'
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm"
              style={{backgroundColor: currentPage === totalPages ? '#ccc' : '#00152F'}}
            >
              Siguiente ›
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm"
              style={{backgroundColor: currentPage === totalPages ? '#ccc' : '#00152F'}}
            >
              Última »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}