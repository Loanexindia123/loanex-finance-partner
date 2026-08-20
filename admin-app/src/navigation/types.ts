import { NavigatorScreenParams } from '@react-navigation/native';
import { MasterListEntityKey } from '../settings/data/masterEntities';

export type DealerTabParamList = {
  Dashboard: undefined;
  Products: undefined;
  Masters: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  DealerTabs: NavigatorScreenParams<DealerTabParamList> | undefined;
  Dashboard: undefined;
  Notifications: undefined;
  MyProfile: undefined;
  ChangePassword: { forced?: boolean } | undefined;
  ModulePlaceholder: { title: string };
  ProductList: undefined;
  AddProduct: { mode?: 'add' | 'edit'; productId?: string } | undefined;
  ProductDetails: { productId: string };
  CustomerList: undefined;
  CustomerDetails: { customerId: string };
  OrderList: undefined;
  OrderDetails: { orderId: string };
  EmiApplicationList: undefined;
  EmiApplicationDetails: { applicationId: string };
  LoanList: undefined;
  LoanDetails: { loanId: string };
  FiCaseList: undefined;
  FiCaseDetails: { fiCaseId: string };
  CreditReviewDetails: { applicationId: string };
  ReportsHome: undefined;
  UserList: undefined;
  UserDetails: { userId: string };
  AddUser: { mode?: 'add' | 'edit'; userId?: string } | undefined;
  RoleList: undefined;
  RoleForm: { mode?: 'add' | 'edit'; roleId?: string } | undefined;
  SettingsHome: undefined;
  CodSettings: undefined;
  MastersHome: undefined;
  MasterList: { entity: MasterListEntityKey };
  CategoriesMaster: undefined;
  ProductTypesMaster: undefined;
  BranchMaster: undefined;
  PincodeMaster: undefined;
};
