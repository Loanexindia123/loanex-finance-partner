import api from './api';

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  brand: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  /** Resolved category name (backend enriches this) */
  category?: string;
  image: string;
  galleryImages: string[];
  price: number;
  mrp: number;
  discount: number;
  stock: number;
  availableStock: number;
  reservedStock: number;
  status: 'active' | 'inactive' | 'draft' | 'pending_approval' | 'rejected' | 'out_of_stock' | 'archived';
  emiAvailable: boolean;
  featured: boolean;
  trending: boolean;
  recommended: boolean;
  warranty: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  status: string;
  sortOrder: number;
  createdAt: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  featured?: boolean;
  trending?: boolean;
  recommended?: boolean;
  search?: string;
  status?: 'all' | 'active' | 'inactive' | 'draft' | 'pending_approval' | 'rejected';
}

/**
 * Get all products with optional filters
 */
export const getProducts = async (params?: ProductQueryParams): Promise<Product[]> => {
  const response = await api.get('/products', { params });
  const data = response.data.data || [];
  const list = Array.isArray(data) ? data : data.items || data.products || [];
  return list;
};

/**
 * Get a single product by ID
 */
export const getProductById = async (productId: string): Promise<Product> => {
  const response = await api.get(`/products/${productId}`);
  return response.data.data;
};

/**
 * Get a product by slug
 */
export const getProductBySlug = async (slug: string): Promise<Product> => {
  const response = await api.get(`/products/slug/${slug}`);
  return response.data.data;
};

/**
 * Create a new product
 */
export const createProduct = async (productData: Partial<Product>): Promise<Product> => {
  const response = await api.post('/products', productData);
  return response.data.data;
};

/**
 * Update an existing product
 */
export const updateProduct = async (productId: string, productData: Partial<Product>): Promise<Product> => {
  const response = await api.put(`/products/${productId}`, productData);
  return response.data.data;
};

/**
 * Delete a product permanently
 */
export const deleteProduct = async (productId: string): Promise<void> => {
  await api.delete(`/products/${productId}`);
};

/**
 * Upload a product image (Admin Web: POST /products/images).
 * Accepts a local file URI from the image picker (deferred until save).
 */
export const uploadProductImage = async (file: {
  uri: string;
  name: string;
  type: string;
}): Promise<{ id: string; url: string; fileName: string }> => {
  const body = new FormData();
  // React Native FormData file shape (uri/name/type)
  body.append('image', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  const response = await api.post('/products/images', body, {
    // Override default application/json so RN sets multipart boundary correctly
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: [(data) => data],
  });
  return response.data.data;
};

/**
 * Get all categories
 */
export const getCategories = async (): Promise<Category[]> => {
  const response = await api.get('/categories');
  return response.data.data || [];
};

/**
 * Get a single category by ID
 */
export const getCategoryById = async (categoryId: string): Promise<Category> => {
  const response = await api.get(`/categories/${categoryId}`);
  return response.data.data;
};
