import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate';
import {
  forbidEmployeeRole,
  requireAnyPermission,
  requireAnyPermissionOrDealer,
  requirePermission,
  requirePermissionOrDealer,
} from '../../common/middleware/require-permission';
import { validateRequest } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/utils/async-handler';
import { adminController } from './admin.controller';
import { branchController } from './branch/branch.controller';
import {
  createBranchBodySchema,
  updateBranchBodySchema,
} from './branch/branch.validator';
import { dealerController } from './dealer/dealer.controller';
import {
  createDealerBodySchema,
  updateDealerBodySchema,
} from './dealer/dealer.validator';
import { emiApplicationController } from '../emi-application/controller/emi-application.controller';
import { emiPaymentController } from '../emi-payment/controller/emi-payment.controller';
import { autopayController } from '../autopay/controller/autopay.controller';
import { adminUpdateAutopaySchema } from '../autopay/validator/autopay.validator';
import { loanController } from '../loan/controller/loan.controller';
import { adminUpdateLoanSchema } from '../loan/validator/loan.validator';
import { notificationController } from '../notifications/controller/notification.controller';
import { adminCreateNotificationSchema } from '../notifications/validator/notification.validator';
import { orderController } from '../order/controller/order.controller';
import { adminUpdateOrderStatusSchema } from '../order/validator/order.validator';
import { adminJobsRouter } from '../careers';
import { settingsController } from '../settings/settings.controller';
import { productTypeController } from './product-type/product-type.controller';
import {
  createProductTypeBodySchema,
  updateProductTypeBodySchema,
} from './product-type/product-type.validator';
import { employeeController } from './employee/employee.controller';
import {
  createEmployeeBodySchema,
  updateEmployeeBodySchema,
} from './employee/employee.validator';
import { freelancerAgentController } from './freelancer-agent/freelancer-agent.controller';
import {
  createFreelancerAgentBodySchema,
  rejectFreelancerAgentBodySchema,
  updateFreelancerAgentBodySchema,
} from './freelancer-agent/freelancer-agent.validator';
import { leadController } from './lead/lead.controller';
import {
  createLeadBodySchema,
  updateLeadBodySchema,
} from './lead/lead.validator';

export const adminRouter = Router();

adminRouter.use(authenticate);

// Destructive wipe — never mount in production.
if (process.env.NODE_ENV !== 'production') {
  adminRouter.post(
    '/dev/clear-orders-emi',
    requirePermission('users.edit'),
    asyncHandler(adminController.clearOrdersAndEmi),
  );
}

// —— Users ——
// —— Portal settings (COD cap etc.) ——
adminRouter.get('/settings', requirePermission('settings.view'), asyncHandler(settingsController.getSettings));
adminRouter.patch(
  '/settings/cod',
  requirePermission('settings.edit'),
  asyncHandler(settingsController.updateCodMaxAmount),
);

adminRouter.get(
  '/users',
  forbidEmployeeRole(),
  requirePermission('users.view'),
  asyncHandler(adminController.listUsers),
);
adminRouter.get(
  '/staff',
  requireAnyPermission(
    'users.view',
    'masters.view',
    'masters.create',
    'products.view',
    'products.create',
    'freelancers.view',
  ),
  asyncHandler(adminController.listStaff),
);
adminRouter.post(
  '/users',
  forbidEmployeeRole(),
  requirePermission('users.create'),
  asyncHandler(adminController.createUser),
);
adminRouter.patch(
  '/users/:id',
  forbidEmployeeRole(),
  requirePermission('users.edit'),
  asyncHandler(adminController.updateUser),
);
adminRouter.delete(
  '/users/:id',
  forbidEmployeeRole(),
  requirePermission('users.delete'),
  asyncHandler(adminController.deleteUser),
);

adminRouter.get('/kyc', requirePermission('customers.view'), asyncHandler(adminController.listKyc));

adminRouter.get(
  '/users/:id/activity',
  forbidEmployeeRole(),
  requirePermission('users.view'),
  asyncHandler(adminController.listUserActivity),
);
adminRouter.get(
  '/users/:id/kyc',
  requirePermission('customers.view'),
  asyncHandler(adminController.listUserKyc),
);

adminRouter.get('/orders', requirePermission('orders.view'), asyncHandler(orderController.adminList));

adminRouter.get(
  '/emi-applications',
  requirePermission('emi.view'),
  asyncHandler(emiApplicationController.listForAdmin),
);

adminRouter.get(
  '/emi-applications/:applicationId',
  requirePermission('emi.view'),
  asyncHandler(emiApplicationController.getByIdForAdmin),
);

adminRouter.post(
  '/emi-applications/:applicationId/assign-fi',
  requirePermission('emi.edit'),
  asyncHandler(emiApplicationController.adminAssignFi),
);

adminRouter.post(
  '/emi-applications/:applicationId/approve',
  requirePermission('emi.edit'),
  asyncHandler(emiApplicationController.adminApprove),
);

adminRouter.post(
  '/emi-applications/:applicationId/reject',
  requirePermission('emi.edit'),
  asyncHandler(emiApplicationController.adminReject),
);

adminRouter.patch(
  '/emi-applications/:applicationId/terms',
  requirePermission('emi.edit'),
  asyncHandler(emiApplicationController.adminModifyTerms),
);

adminRouter.patch(
  '/orders/:orderId/status',
  requirePermission('orders.edit'),
  validateRequest(adminUpdateOrderStatusSchema),
  asyncHandler(orderController.adminUpdateStatus),
);

adminRouter.get('/loans', requirePermission('emi.view'), asyncHandler(loanController.listForAdmin));
adminRouter.get('/loans/:loanId', requirePermission('emi.view'), asyncHandler(loanController.getForAdmin));
adminRouter.patch(
  '/loans/:loanId',
  requirePermission('emi.edit'),
  validateRequest(adminUpdateLoanSchema),
  asyncHandler(loanController.adminUpdate),
);
adminRouter.get('/emi-payments', requirePermission('emi.view'), asyncHandler(emiPaymentController.listForAdmin));

adminRouter.get('/autopay', requirePermission('emi.view'), asyncHandler(autopayController.listForAdmin));
adminRouter.get('/autopay/:loanId', requirePermission('emi.view'), asyncHandler(autopayController.getForAdmin));
adminRouter.patch(
  '/autopay/:loanId',
  requirePermission('emi.edit'),
  validateRequest(adminUpdateAutopaySchema),
  asyncHandler(autopayController.adminUpdate),
);

adminRouter.get('/notifications', requirePermission('notifications.view'), asyncHandler(notificationController.listForAdmin));
adminRouter.post(
  '/notifications',
  requirePermission('notifications.create'),
  validateRequest(adminCreateNotificationSchema),
  asyncHandler(notificationController.adminCreate),
);
adminRouter.delete(
  '/notifications/:id',
  requirePermission('notifications.delete'),
  asyncHandler(notificationController.adminDelete),
);
adminRouter.patch(
  '/notifications/read-all',
  requirePermission('notifications.edit'),
  asyncHandler(notificationController.adminMarkAllRead),
);
adminRouter.patch(
  '/notifications/:id/read',
  requirePermission('notifications.edit'),
  asyncHandler(notificationController.adminMarkRead),
);

// —— FI cases ——
adminRouter.get('/fi-cases', requirePermission('fi.view'), asyncHandler(adminController.listFiCases));
adminRouter.get('/fi-cases/:fiCaseId', requirePermission('fi.view'), asyncHandler(adminController.getFiCase));
adminRouter.patch('/fi-cases/:fiCaseId', requirePermission('fi.edit'), asyncHandler(adminController.updateFiCase));

// —— Credit review (by EMI application id) ——
adminRouter.get(
  '/credit-reviews/:applicationId',
  requirePermission('emi.view'),
  asyncHandler(adminController.getCreditReview),
);
adminRouter.patch(
  '/credit-reviews/:applicationId',
  requirePermission('emi.edit'),
  asyncHandler(adminController.upsertCreditReview),
);

// —— Branches (dedicated: validation + GET by id; same /admin/branches contract) ——
adminRouter.get(
  '/branches',
  requirePermission('masters.view'),
  asyncHandler(branchController.list),
);
adminRouter.post(
  '/branches',
  requirePermission('masters.create'),
  validateRequest(createBranchBodySchema),
  asyncHandler(branchController.create),
);
adminRouter.get(
  '/branches/:id',
  requirePermission('masters.view'),
  asyncHandler(branchController.getById),
);
adminRouter.put(
  '/branches/:id',
  requirePermission('masters.edit'),
  validateRequest(updateBranchBodySchema),
  asyncHandler(branchController.update),
);
adminRouter.delete(
  '/branches/:id',
  requirePermission('masters.delete'),
  asyncHandler(branchController.remove),
);

// —— Dealers (dedicated: validation + GET by id; same /admin/dealers contract) ——
// Agents may create/list dealers they own; Dealers may list child-agent dealers.
adminRouter.get(
  '/dealers',
  requireAnyPermissionOrDealer('masters.view'),
  asyncHandler(dealerController.list),
);
adminRouter.post(
  '/dealers',
  requireAnyPermissionOrDealer('masters.create'),
  validateRequest(createDealerBodySchema),
  asyncHandler(dealerController.create),
);
adminRouter.get(
  '/dealers/:id',
  requireAnyPermissionOrDealer('masters.view'),
  asyncHandler(dealerController.getById),
);
adminRouter.put(
  '/dealers/:id',
  requireAnyPermissionOrDealer('masters.edit'),
  validateRequest(updateDealerBodySchema),
  asyncHandler(dealerController.update),
);
adminRouter.delete(
  '/dealers/:id',
  requirePermission('masters.delete'),
  asyncHandler(dealerController.remove),
);

// —— Product Types (dedicated: name uniqueness + seed defaults) ——
// Dealers use these from admin-app Masters; staff need masters.* or products.* .
adminRouter.get(
  '/product_types',
  requireAnyPermissionOrDealer('masters.view', 'products.view'),
  asyncHandler(productTypeController.list),
);
adminRouter.get(
  '/product_types/active',
  requireAnyPermissionOrDealer('masters.view', 'products.view'),
  asyncHandler(productTypeController.listActive),
);
adminRouter.post(
  '/product_types',
  requireAnyPermissionOrDealer('masters.create', 'products.create'),
  validateRequest(createProductTypeBodySchema),
  asyncHandler(productTypeController.create),
);
adminRouter.get(
  '/product_types/:id',
  requireAnyPermissionOrDealer('masters.view', 'products.view'),
  asyncHandler(productTypeController.getById),
);
adminRouter.put(
  '/product_types/:id',
  requireAnyPermissionOrDealer('masters.edit', 'products.edit'),
  validateRequest(updateProductTypeBodySchema),
  asyncHandler(productTypeController.update),
);
adminRouter.delete(
  '/product_types/:id',
  requireAnyPermissionOrDealer('masters.delete', 'products.edit'),
  asyncHandler(productTypeController.remove),
);

// —— Employee onboarding (dedicated collection; does not mutate /admin/users) ——
adminRouter.get(
  '/employees',
  requirePermission('users.view'),
  asyncHandler(employeeController.list),
);
adminRouter.get(
  '/employees/onboarders',
  requirePermission('users.create'),
  asyncHandler(employeeController.listOnboarders),
);
adminRouter.post(
  '/employees',
  requirePermission('users.create'),
  validateRequest(createEmployeeBodySchema),
  asyncHandler(employeeController.create),
);
adminRouter.get(
  '/employees/:id',
  requirePermission('users.view'),
  asyncHandler(employeeController.getById),
);
adminRouter.put(
  '/employees/:id',
  requirePermission('users.edit'),
  validateRequest(updateEmployeeBodySchema),
  asyncHandler(employeeController.update),
);
adminRouter.delete(
  '/employees/:id',
  requirePermission('users.delete'),
  asyncHandler(employeeController.remove),
);

// —— Freelancer / Growing Partner onboarding (dedicated collection; not employees) ——
// Dealers may list/create/edit only their own agents via the same endpoints (scoped in service).
adminRouter.get(
  '/freelancer-agents',
  requirePermissionOrDealer('freelancers.view'),
  asyncHandler(freelancerAgentController.list),
);
adminRouter.get(
  '/freelancer-agents/creators',
  requirePermission('freelancers.create'),
  asyncHandler(freelancerAgentController.listCreators),
);
adminRouter.post(
  '/freelancer-agents',
  requirePermissionOrDealer('freelancers.create'),
  validateRequest(createFreelancerAgentBodySchema),
  asyncHandler(freelancerAgentController.create),
);
adminRouter.get(
  '/freelancer-agents/:id',
  requirePermissionOrDealer('freelancers.view'),
  asyncHandler(freelancerAgentController.getById),
);
adminRouter.put(
  '/freelancer-agents/:id',
  requirePermissionOrDealer('freelancers.edit'),
  validateRequest(updateFreelancerAgentBodySchema),
  asyncHandler(freelancerAgentController.update),
);
adminRouter.post(
  '/freelancer-agents/:id/approve',
  requirePermission('freelancers.approve'),
  asyncHandler(freelancerAgentController.approve),
);
adminRouter.post(
  '/freelancer-agents/:id/reject',
  requirePermission('freelancers.reject'),
  validateRequest(rejectFreelancerAgentBodySchema),
  asyncHandler(freelancerAgentController.reject),
);
adminRouter.delete(
  '/freelancer-agents/:id',
  requirePermissionOrDealer('freelancers.delete'),
  asyncHandler(freelancerAgentController.remove),
);

// —— Leads (Dealer/Agent field module) ——
adminRouter.get(
  '/leads',
  requireAnyPermissionOrDealer('masters.view'),
  asyncHandler(leadController.list),
);
adminRouter.post(
  '/leads',
  requireAnyPermissionOrDealer('masters.create'),
  validateRequest(createLeadBodySchema),
  asyncHandler(leadController.create),
);
adminRouter.get(
  '/leads/:id',
  requireAnyPermissionOrDealer('masters.view'),
  asyncHandler(leadController.getById),
);
adminRouter.put(
  '/leads/:id',
  requireAnyPermissionOrDealer('masters.edit'),
  validateRequest(updateLeadBodySchema),
  asyncHandler(leadController.update),
);
adminRouter.delete(
  '/leads/:id',
  requirePermission('masters.delete'),
  asyncHandler(leadController.remove),
);

// —— Master data (other collections; branches + dealers + product_types handled above) ——
// Brands/categories: Dealers and Agents need catalogue masters for product create.
for (const collection of [
  'suppliers',
  'warehouses',
  'brands',
  'pincodes',
  'wholesalers',
  'delivery_partners',
  'delivery_zones',
  'manufacturers',
  'sub_categories',
  'product_attributes',
  'product_attribute_values',
  'product_variants',
  'product_variant_attributes',
] as const) {
  const isCatalogueMaster = collection === 'brands' || collection === 'sub_categories';
  const viewGuard = isCatalogueMaster
    ? requireAnyPermissionOrDealer('masters.view', 'products.view')
    : requirePermission('masters.view');
  const createGuard = isCatalogueMaster
    ? requireAnyPermissionOrDealer('masters.create', 'products.create')
    : requirePermission('masters.create');
  const editGuard = isCatalogueMaster
    ? requireAnyPermissionOrDealer('masters.edit', 'products.edit')
    : requirePermission('masters.edit');
  const deleteGuard = requirePermission('masters.delete');

  adminRouter.get(`/${collection}`, viewGuard, asyncHandler(adminController.listMaster));
  adminRouter.post(`/${collection}`, createGuard, asyncHandler(adminController.createMaster));
  adminRouter.put(`/${collection}/:id`, editGuard, asyncHandler(adminController.updateMaster));
  adminRouter.delete(`/${collection}/:id`, deleteGuard, asyncHandler(adminController.deleteMaster));
}

// —— Careers job openings (Admin Mobile App) ——
adminRouter.use('/jobs', adminJobsRouter);
