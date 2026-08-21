import api from './api';
import { getProducts } from './productService';
import { getAllOrders } from './orderService';
import { getAllEmiApplications } from './emiService';
import { listAgents } from './agentService';
import { listDealers } from './dealerService';
import { listLeads } from './leadService';
import { listEmployees } from './employeeService';
import { getRbacState } from '../auth/rbacStore';

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
  totalAgents?: number;
  totalDealers?: number;
  totalLeads?: number;
  totalEmployees?: number;
}

/** Dealer + Agent dashboard — counts come from server-scoped list APIs. */
export const getDealerDashboardStats = async (): Promise<DashboardStats> => {
  const [productList, agents, dealers, leads] = await Promise.all([
    getProducts({ limit: 1000, status: 'all' }).catch(() => []),
    listAgents().catch(() => []),
    listDealers().catch(() => []),
    listLeads().catch(() => []),
  ]);
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
    totalAgents: agents.length,
    totalDealers: dealers.length,
    totalLeads: leads.length,
  };
};

/**
 * Employee dashboard — only records created by the logged-in employee.
 * List APIs are already server-scoped; we further filter by creator/onboardedBy.
 */
export const getEmployeeDashboardStats = async (): Promise<DashboardStats> => {
  const userId = String(getRbacState().user?.id ?? '').trim();
  const [productList, agents, dealers, employees] = await Promise.all([
    getProducts({ limit: 1000, status: 'all' }).catch(() => []),
    listAgents().catch(() => []),
    listDealers().catch(() => []),
    listEmployees().catch(() => []),
  ]);

  const ownProducts = productList.filter(
    (p: any) => !userId || String(p.creatorId ?? '').trim() === userId,
  );
  const ownDealers = dealers.filter(
    (d) => !userId || String(d.creatorId ?? '').trim() === userId,
  );
  const ownAgents = agents.filter(
    (a) =>
      !userId ||
      String(a.creatorId ?? '').trim() === userId ||
      String((a as any).createdById ?? '').trim() === userId,
  );

  // Direct creates: onboardedById is viewer userId or one of their own employee row ids.
  const selfEmployeeIds = new Set(
    employees
      .filter((e) => String(e.userId ?? '').trim() === userId)
      .map((e) => e.id)
      .filter(Boolean),
  );
  const parentKeys = new Set([userId, ...selfEmployeeIds].filter(Boolean));
  const ownEmployees = employees.filter((e) => {
    if (selfEmployeeIds.has(e.id)) return false;
    return parentKeys.has(String(e.onboardedById ?? '').trim());
  });

  return {
    totalProducts: ownProducts.length,
    totalOrders: 0,
    pendingOrders: 0,
    totalEmiApplications: 0,
    pendingEmiApplications: 0,
    totalRevenue: 0,
    recentOrders: [],
    totalAgents: ownAgents.length,
    totalDealers: ownDealers.length,
    totalEmployees: ownEmployees.length,
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

    const isPaid = (o: any) => {
      const ps = String(o.paymentStatus ?? o.payment_status ?? '').toUpperCase();
      return ps === 'SUCCESS' || ps === 'PAID';
    };
    const seen = new Set<string>();
    const totalRevenue = orderList
      .filter((o: any) => {
        if (!isPaid(o)) return false;
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      })
      .reduce((sum: number, o: any) => sum + (o.totalAmount || o.orderAmount || 0), 0);

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
