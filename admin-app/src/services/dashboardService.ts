import api from './api';
import { getProducts } from './productService';
import { getAllOrders } from './orderService';
import { getAllEmiApplications } from './emiService';

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalEmiApplications: number;
  pendingEmiApplications: number;
  totalRevenue: number;
  recentOrders: any[];
  draftProducts?: number;
  pendingApprovalProducts?: number;
  approvedProducts?: number;
  rejectedProducts?: number;
}

export const getDealerDashboardStats = async (): Promise<DashboardStats> => {
  const productList = await getProducts({ limit: 1000, status: 'all' }).catch(() => []);
  const statusOf = (p: any) => String(p.status ?? '').toLowerCase();
  return {
    totalProducts: productList.length,
    totalOrders: 0,
    pendingOrders: 0,
    totalEmiApplications: 0,
    pendingEmiApplications: 0,
    totalRevenue: 0,
    recentOrders: [],
    draftProducts: productList.filter((p: any) => statusOf(p) === 'draft').length,
    pendingApprovalProducts: productList.filter((p: any) => statusOf(p) === 'pending_approval').length,
    approvedProducts: productList.filter((p: any) => statusOf(p) === 'active').length,
    rejectedProducts: productList.filter((p: any) => statusOf(p) === 'rejected').length,
  };
};

/**
 * Fetch dashboard statistics by aggregating data from multiple endpoints
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Fetch all data in parallel
    const [products, orders, emiApplications] = await Promise.allSettled([
      getProducts({ limit: 1000, status: 'all' }),
      getAllOrders(),
      getAllEmiApplications(),
    ]);

    const productList = products.status === 'fulfilled' ? products.value : [];
    const orderList = orders.status === 'fulfilled' ? orders.value : [];
    const emiList = emiApplications.status === 'fulfilled' ? emiApplications.value : [];

    // Calculate stats
    const pendingOrders = orderList.filter(
      (o: any) =>
        o.status === 'pending' ||
        o.status === 'confirmed' ||
        o.status === 'processing' ||
        o.status === 'packed' ||
        o.status === 'shipped' ||
        o.status === 'out_for_delivery'
    );

    const pendingEmi = emiList.filter(
      (e: any) => e.status === 'pending' || e.status === 'under_review'
    );

    // Revenue = value of paid orders, regardless of delivery stage. An order
    // counts once its payment is successful (Razorpay/EMI/COD paid), not only
    // after it is marked delivered — otherwise the dashboard shows ₹0 until
    // the parcel ships. The backend admin list emits paymentStatus
    // ('SUCCESS'/'PENDING'), which mapBackendOrderToFrontend carries onto
    // Order.paymentStatus. (For EMI orders this is the full order value even
    // when only the down payment has been collected — GMV of paid orders.)
    const isPaid = (o: any) => {
      const ps = String(o.paymentStatus ?? o.payment_status ?? '').toUpperCase();
      return ps === 'SUCCESS' || ps === 'PAID';
    };
    // Dedupe by order id first — mirror/retry artifacts can leave duplicate
    // rows for the same order, which would otherwise inflate the total.
    const seen = new Set<string>();
    const totalRevenue = orderList
      .filter((o: any) => {
        if (!isPaid(o)) return false;
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      })
      .reduce((sum: number, o: any) => sum + (o.totalAmount || o.orderAmount || 0), 0);

    // Get recent orders (last 10, sorted by date)
    const recentOrders = [...orderList]
      .sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
      .slice(0, 10);

    return {
      totalProducts: productList.length,
      totalOrders: orderList.length,
      pendingOrders: pendingOrders.length,
      totalEmiApplications: emiList.length,
      pendingEmiApplications: pendingEmi.length,
      totalRevenue,
      recentOrders,
    };
  } catch (error) {
    console.error('[Dashboard] Failed to fetch stats:', error);
    return {
      totalProducts: 0,
      totalOrders: 0,
      pendingOrders: 0,
      totalEmiApplications: 0,
      pendingEmiApplications: 0,
      totalRevenue: 0,
      recentOrders: [],
    };
  }
};
