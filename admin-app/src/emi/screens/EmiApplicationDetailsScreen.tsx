import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getEmiApplicationById, getAllFiCases, approveEmiApplication, rejectEmiApplication, modifyEmiApplicationTerms, assignFiForApplication, EmiApplication } from '../../services/emiService';
import { getOrderById } from '../../services/orderService';
import { Order, OrderStatus } from '../../types/order';
import { findCreditReview } from '../data/creditReviewMockData';
import { findFiCaseForApplicationSync } from '../../fi/utils/findFiCaseForApplication';
import { getFiStatusLabel } from '../../fi/data/fiWorkflowStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DetailRow } from '../../components/ui/DetailRow';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { RootStackParamList } from '../../navigation/types';
import { EmiApplicationStatus } from '../../types/emiApplication';
import { FiCase, FiCaseStatus } from '../../types/fiCase';

type Props = NativeStackScreenProps<RootStackParamList, 'EmiApplicationDetails'>;

const STATUS_LABEL: Record<EmiApplicationStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  hold: 'Hold',
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Order Confirmed',
  approved: 'Approved',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(date: string) {
  if (!date || date === '—') return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function displayMeta(value?: string) {
  return value && value !== '—' ? value : '—';
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Down payment first, then each paid EMI — mirrors the invoice's Payment History. */
function paymentHistory(order: Order): { label: string; date: string | null; amount: number }[] {
  const rows: { label: string; date: string | null; amount: number }[] = [];
  if (order.downPaymentCollected && order.downPaymentCollected > 0) {
    rows.push({
      label: 'Down Payment',
      date: order.transactionDate ?? null,
      amount: order.downPaymentCollected,
    });
  }
  for (const payment of order.emiPayments ?? []) {
    rows.push({
      label: `EMI #${payment.emiNumber}`,
      date: payment.paidAt ?? payment.dueDate ?? null,
      amount: payment.amount,
    });
  }
  return rows;
}

/** True when the fetched order carries live loan data to mirror. */
function hasLoanLedger(order: Order | null): boolean {
  return Boolean(
    order &&
      (order.loanStatus ||
        order.loanAccountNumber ||
        (order.emiSchedule ?? []).length > 0),
  );
}

export function EmiApplicationDetailsScreen({ navigation, route }: Props) {
  const [application, setApplication] = useState<EmiApplication | null>(null);
  const [fiCase, setFiCase] = useState<FiCase | undefined>(undefined);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [approving, setApproving] = useState<boolean>(false);
  const [rejecting, setRejecting] = useState<boolean>(false);
  const [assigningFi, setAssigningFi] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
  const [termsDraft, setTermsDraft] = useState<{
    approvedAmount: string;
    approvedTenure: string;
    approvedDownPayment: string;
    interestRate: string;
    processingFee: string;
    adminRemarks: string;
  }>({
    approvedAmount: '',
    approvedTenure: '',
    approvedDownPayment: '',
    interestRate: '',
    processingFee: '',
    adminRemarks: '',
  });

  // Seed the sanction editor when the application loads.
  React.useEffect(() => {
    if (application) {
      setTermsDraft((prev) => ({
        approvedAmount: String(application.totalAmount ?? application.requestedLoanAmount ?? ''),
        approvedTenure: String(application.tenure ?? ''),
        approvedDownPayment: String(application.downPayment ?? ''),
        interestRate: String((application as any).interestRate ?? 18),
        processingFee: String((application as any).processingFee ?? 499),
        adminRemarks: prev.adminRemarks || '',
      }));
    }
  }, [application]);

  const fetchOrder = useCallback(async (app: EmiApplication) => {
    if (!app.orderId) {
      setOrder(null);
      return;
    }
    try {
      const found = await getOrderById(app.orderId);
      setOrder(found);
    } catch (error) {
      console.error('Failed to load order for application:', error);
      setOrder(null);
    }
  }, []);

  const reloadApplication = useCallback(async () => {
    const app = await getEmiApplicationById(route.params.applicationId);
    setApplication(app);
    if (app) {
      const fiList = await getAllFiCases();
      const found = findFiCaseForApplicationSync(app, fiList);
      setFiCase(found);
      await fetchOrder(app);
    }
  }, [route.params.applicationId, fetchOrder]);

  const handleApprove = useCallback(async () => {
    if (!application || approving) return;
    setApproving(true);
    try {
      await approveEmiApplication(application.id);
      setApplication((prev) => (prev ? { ...prev, status: 'approved' } : prev));
      await reloadApplication();
    } catch (error: any) {
      console.error('Failed to approve EMI application:', error);
      // eslint-disable-next-line no-alert
      window.alert(error?.message || 'Unable to approve. Field Investigation must be accepted first.');
    } finally {
      setApproving(false);
    }
  }, [application, approving, reloadApplication]);

  const handleAssignFi = useCallback(async () => {
    if (!application || assigningFi) return;
    setAssigningFi(true);
    try {
      const created = await assignFiForApplication(application.id);
      setFiCase(created);
      await reloadApplication();
    } catch (error: any) {
      console.error('Failed to assign FI:', error);
      // eslint-disable-next-line no-alert
      window.alert(error?.message || 'Unable to assign Field Investigation.');
    } finally {
      setAssigningFi(false);
    }
  }, [application, assigningFi, reloadApplication]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      setLoading(true);
      getEmiApplicationById(route.params.applicationId)
        .then(async (app) => {
          if (!isMounted) return;
          setApplication(app);
          if (app) {
            const fiList = await getAllFiCases();
            const found = findFiCaseForApplicationSync(app, fiList);
            if (isMounted) setFiCase(found);
            await fetchOrder(app);
          }
        })
        .catch((err) => console.error(err))
        .finally(() => {
          if (isMounted) setLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }, [route.params.applicationId, fetchOrder]),
  );
  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Dashboard');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleGoBack();
        return true;
      });
      return () => subscription.remove();
    }, [handleGoBack]),
  );

  const creditReview = application ? findCreditReview(application.id) : undefined;

  const creditReviewStatus = creditReview?.creditStatus ?? 'Waiting';

  const fiStatus: FiCaseStatus | undefined = fiCase?.status;
  const fiPending = fiStatus === 'pending';
  const fiButtonTitle =
    fiStatus === 'pending' || fiStatus === 'in_progress' ? 'View FI Status' : 'View FI';
  const fiCompleted = fiStatus === 'completed';
  const fiRejected = fiStatus === 'hold';

  const canAssignFi =
    !fiCase &&
    (application?.status === 'pending' || application?.status === 'under_review');

  const canApprove =
    (application?.status === 'pending' || application?.status === 'under_review') &&
    fiCompleted;

  const canEditSanction =
    application?.status === 'approved' ||
    (application?.status === 'under_review' && fiCompleted);

  const fiRejectionReason =
    (fiRejected && fiCase?.remarks?.trim()) ||
    (application?.status === 'rejected' ? (application as any).rejectionReason : null) ||
    null;

  const handleReject = useCallback(async () => {
    if (!application || rejecting) return;
    if (!rejectionReason.trim()) {
      // eslint-disable-next-line no-alert
      window.alert('Please enter a rejection reason.');
      return;
    }
    setRejecting(true);
    try {
      await rejectEmiApplication(application.id, rejectionReason.trim());
      setApplication((prev) => (prev ? { ...prev, status: 'rejected' } : prev));
      setShowRejectBox(false);
      await reloadApplication();
    } catch (error) {
      console.error('Failed to reject EMI application:', error);
    } finally {
      setRejecting(false);
    }
  }, [application, rejecting, rejectionReason, reloadApplication]);

  const handlePublishTerms = useCallback(async () => {
    if (!application || publishing) return;
    setPublishing(true);
    try {
      await modifyEmiApplicationTerms(application.id, {
        approvedAmount: termsDraft.approvedAmount
          ? Number(termsDraft.approvedAmount)
          : undefined,
        approvedTenure: termsDraft.approvedTenure
          ? Number(termsDraft.approvedTenure)
          : undefined,
        approvedDownPayment: termsDraft.approvedDownPayment
          ? Number(termsDraft.approvedDownPayment)
          : undefined,
        interestRate: termsDraft.interestRate
          ? Number(termsDraft.interestRate)
          : undefined,
        processingFee: termsDraft.processingFee
          ? Number(termsDraft.processingFee)
          : undefined,
        adminRemarks: termsDraft.adminRemarks.trim()
          ? termsDraft.adminRemarks.trim()
          : 'Terms modified by admin.',
      });
      // eslint-disable-next-line no-alert
      window.alert('Sanction updated and published to the customer. They can accept or decline it.');
      await reloadApplication();
    } catch (error: any) {
      console.error('Failed to publish modified terms:', error);
      // eslint-disable-next-line no-alert
      window.alert(error?.message || 'Failed to publish modified terms.');
    } finally {
      setPublishing(false);
    }
  }, [application, publishing, termsDraft, reloadApplication]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EMI Application Details</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.notFound}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.notFoundText, { marginTop: spacing.md }]}>Loading Application Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EMI Application Details</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Application not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const orderStatusLabel = order ? ORDER_STATUS_LABEL[order.status] : '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EMI Application Details</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.section}>
          <SectionTitle title="Application Information" />
          <DetailRow label="Application ID" value={application.id} />
          <DetailRow label="Application Date" value={formatDate(application.applicationDate)} />
          <DetailRow label="Status" value={STATUS_LABEL[application.status]} isLast={!canApprove} />
          {canApprove && (
            <>
              <Button
                title={approving ? 'Approving...' : 'Approve Application'}
                variant="primary"
                disabled={approving}
                onPress={handleApprove}
                style={styles.workflowBtn}
              />
              <Button
                title={showRejectBox ? 'Cancel' : 'Reject Application'}
                variant="outline"
                disabled={rejecting}
                onPress={() => setShowRejectBox((v) => !v)}
                style={styles.workflowBtn}
              />
              {showRejectBox && (
                <View style={styles.rejectBox}>
                  <TextInput
                    style={styles.rejectInput}
                    placeholder="Reason for rejection"
                    placeholderTextColor={colors.textMuted}
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    multiline
                  />
                  <Button
                    title={rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                    variant="danger"
                    disabled={rejecting}
                    onPress={handleReject}
                  />
                </View>
              )}
            </>
          )}
        </Card>

        {/* ── Sanction (edit + publish to customer) ─────────────────────── */}
        {canEditSanction && (
          <Card style={styles.section}>
            <SectionTitle title="Sanction / Loan Terms" />
            <Text style={styles.helperText}>
              Adjust the loan terms below and publish them. The customer will see the
              modified application and can accept (pay down payment) or decline it.
            </Text>
            <Text style={styles.fieldLabel}>Loan Amount (₹)</Text>
            <TextInput
              style={styles.rejectInput}
              keyboardType="numeric"
              value={termsDraft.approvedAmount}
              onChangeText={(t) => setTermsDraft((p) => ({ ...p, approvedAmount: t }))}
            />
            <Text style={styles.fieldLabel}>Tenure (months)</Text>
            <TextInput
              style={styles.rejectInput}
              keyboardType="numeric"
              value={termsDraft.approvedTenure}
              onChangeText={(t) => setTermsDraft((p) => ({ ...p, approvedTenure: t }))}
            />
            <Text style={styles.fieldLabel}>Down Payment (₹)</Text>
            <TextInput
              style={styles.rejectInput}
              keyboardType="numeric"
              value={termsDraft.approvedDownPayment}
              onChangeText={(t) => setTermsDraft((p) => ({ ...p, approvedDownPayment: t }))}
            />
            <Text style={styles.fieldLabel}>Interest Rate (% p.a.)</Text>
            <TextInput
              style={styles.rejectInput}
              keyboardType="numeric"
              value={termsDraft.interestRate}
              onChangeText={(t) => setTermsDraft((p) => ({ ...p, interestRate: t }))}
            />
            <Text style={styles.fieldLabel}>Processing Fee (₹)</Text>
            <TextInput
              style={styles.rejectInput}
              keyboardType="numeric"
              value={termsDraft.processingFee}
              onChangeText={(t) => setTermsDraft((p) => ({ ...p, processingFee: t }))}
            />
            <Text style={styles.fieldLabel}>Admin Remarks</Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="Visible to the customer with the modified offer"
              placeholderTextColor={colors.textMuted}
              value={termsDraft.adminRemarks}
              onChangeText={(t) => setTermsDraft((p) => ({ ...p, adminRemarks: t }))}
              multiline
            />
            <Button
              title={publishing ? 'Publishing...' : 'Publish to Customer'}
              variant="primary"
              disabled={publishing}
              onPress={handlePublishTerms}
              style={styles.workflowBtn}
            />
          </Card>
        )}

        <Card style={styles.section}>
          <SectionTitle title="Customer Information" />
          <DetailRow label="Customer Name" value={application.customerName} />
          <DetailRow label="Mobile Number" value={application.mobile} isLast />
        </Card>

        <Card style={styles.section}>
          <SectionTitle title="Product & EMI" />
          <DetailRow label="Selected Product" value={application.selectedProduct} />
          <DetailRow
            label="Requested Loan Amount"
            value={formatAmount(application.requestedLoanAmount)}
          />
          <DetailRow label="EMI Plan" value={application.emiPlan} isLast />
        </Card>

        {/* ── FI ─────────────────────────────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionTitle title="Field Investigation" />
          <DetailRow
            label="Current Status"
            value={fiCase ? getFiStatusLabel(fiCase.status) : '—'}
          />
          <DetailRow
            label="Completed By"
            value={fiCompleted ? fiCase?.assignedExecutive ?? '—' : '—'}
          />
          <DetailRow
            label="Completed Date & Time"
            value={fiCompleted ? formatDate(fiCase?.assignedDate ?? '—') : '—'}
            isLast={!fiCase && !canAssignFi && !fiRejectionReason}
          />
          {fiRejectionReason ? (
            <DetailRow label="FI Rejection Reason" value={String(fiRejectionReason)} isLast={false} />
          ) : null}
          {fiCase && (fiPending || fiStatus === 'in_progress') ? (
            <DetailRow
              label="Note"
              value="FI Accept / Reject is completed in the FI Mobile App."
              isLast={!canAssignFi}
            />
          ) : null}
          {fiCompleted && application.status === 'under_review' ? (
            <DetailRow
              label="Next Step"
              value="FI Accepted. Continue with Credit Review, then Publish to Customer."
              isLast={!canAssignFi}
            />
          ) : null}
          {canAssignFi && (
            <Button
              title={assigningFi ? 'Assigning...' : 'Assign FI'}
              variant="primary"
              disabled={assigningFi}
              onPress={handleAssignFi}
              style={styles.workflowBtn}
            />
          )}
          {fiCase && (
            <Button
              title={fiButtonTitle}
              variant="outline"
              onPress={() =>
                navigation.navigate('FiCaseDetails', { fiCaseId: fiCase.id })
              }
              style={styles.workflowBtn}
            />
          )}
        </Card>

        {/* ── Credit Review ──────────────────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionTitle title="Credit Review" />
          <DetailRow label="Current Status" value={creditReviewStatus} />
          <DetailRow
            label="Completed By"
            value={
              creditReview?.creditStatus === 'Completed'
                ? displayMeta(creditReview.reviewer)
                : '—'
            }
          />
          <DetailRow
            label="Completed Date & Time"
            value={
              creditReview?.creditStatus === 'Completed'
                ? formatDate(creditReview.reviewDate)
                : '—'
            }
            isLast
          />
          <Button
            title="View Credit Review"
            variant="outline"
            onPress={() =>
              navigation.navigate('CreditReviewDetails', {
                applicationId: application.id,
              })
            }
            style={styles.workflowBtn}
          />
        </Card>

        {/* ── Loan Ledger (live from the order once down payment is paid;
             mirrors the Order Details ledger so approvers see the full
             repayment runway inline) ────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionTitle
            title={hasLoanLedger(order) ? 'Loan Ledger' : 'Down Payment'}
          />
          {hasLoanLedger(order) && order ? (
            <>
              <DetailRow label="EMI Plan" value={order.emiPlan ?? '—'} />
              <DetailRow
                label="EMI Amount"
                value={order.emiAmount != null ? formatAmount(order.emiAmount) : '—'}
              />
              <DetailRow label="EMI Duration" value={order.emiDuration ?? '—'} />
              <DetailRow
                label="Loan Status"
                value={order.loanStatus ? formatLabel(order.loanStatus) : '—'}
              />
              <DetailRow label="Loan Account" value={order.loanAccountNumber ?? '—'} />
              <DetailRow
                label="Loan Amount"
                value={order.loanAmount != null ? formatAmount(order.loanAmount) : '—'}
              />
              <DetailRow
                label="Down Payment"
                value={order.downPayment != null ? formatAmount(order.downPayment) : '—'}
              />
              <DetailRow
                label="Down Payment Collected"
                value={
                  order.downPaymentCollected != null && order.downPaymentCollected > 0
                    ? formatAmount(order.downPaymentCollected)
                    : 'Not paid'
                }
              />
              <DetailRow
                label="Amount Paid"
                value={
                  order.amountPaid != null && order.amountPaid > 0
                    ? formatAmount(order.amountPaid)
                    : '—'
                }
              />
              <DetailRow
                label="Outstanding Balance"
                value={
                  order.outstandingAmount != null
                    ? formatAmount(order.outstandingAmount)
                    : '—'
                }
              />
              <DetailRow
                label="Installments Paid"
                value={
                  order.paidEmiCount != null && order.totalEmiCount != null
                    ? `${order.paidEmiCount} of ${order.totalEmiCount}`
                    : '—'
                }
              />
              {order.nextEmiDueDate && (
                <DetailRow label="Next EMI Due" value={formatDate(order.nextEmiDueDate)} />
              )}
              <DetailRow
                label="Interest Rate"
                value={order.interestRate != null ? `${order.interestRate}% p.a.` : '—'}
              />
              <DetailRow
                label="Processing Fee"
                value={order.processingFee != null ? formatAmount(order.processingFee) : '—'}
                isLast={
                  paymentHistory(order).length === 0 &&
                  (order.emiSchedule ?? []).filter((row) => row.paymentStatus !== 'PAID')
                    .length === 0
                }
              />

              {/* Payment history — down payment + each paid EMI, live */}
              {paymentHistory(order).length > 0 && (
                <View style={styles.paymentHistory}>
                  <Text style={styles.paymentHistoryTitle}>Payment History</Text>
                  {paymentHistory(order).map((row) => (
                    <View key={row.label} style={styles.paymentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paymentLabel}>{row.label}</Text>
                        <Text style={styles.paymentDate}>
                          {row.date ? formatDate(row.date) : '—'}
                        </Text>
                      </View>
                      <Text style={styles.paymentAmount}>{formatAmount(row.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Upcoming installments — unpaid runway, overdue when past due */}
              {(order.emiSchedule ?? []).filter((row) => row.paymentStatus !== 'PAID')
                .length > 0 && (
                <View style={styles.paymentHistory}>
                  <Text style={styles.paymentHistoryTitle}>Upcoming Installments</Text>
                  {(order.emiSchedule ?? [])
                    .filter((row) => row.paymentStatus !== 'PAID')
                    .map((row) => (
                      <View key={row.emiNumber} style={styles.paymentRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paymentLabel}>EMI #{row.emiNumber}</Text>
                          <Text style={styles.paymentDate}>
                            Due {row.dueDate ? formatDate(row.dueDate) : '—'} ·{' '}
                            <Text
                              style={{
                                color:
                                  row.paymentStatus === 'OVERDUE'
                                    ? '#b91c1c'
                                    : colors.textMuted,
                              }}
                            >
                              {row.paymentStatus === 'OVERDUE' ? 'Overdue' : 'Pending'}
                            </Text>
                          </Text>
                        </View>
                        <Text style={styles.paymentAmount}>{formatAmount(row.amount)}</Text>
                      </View>
                    ))}
                </View>
              )}
            </>
          ) : (
            <>
              <DetailRow
                label="Current Status"
                value={
                  application.loanId || application.orderId ? 'Loan Created' : 'Pending'
                }
                isLast
              />
              <Text style={styles.helperText}>
                The down payment is collected from the customer after the offer is
                accepted. An order is created automatically once the payment is confirmed
                — the full loan ledger appears here at that point.
              </Text>
            </>
          )}
          {application.loanId && (
            <Button
              title="View Full Ledger"
              variant="outline"
              onPress={() =>
                navigation.navigate('LoanDetails', { loanId: application.loanId! })
              }
              style={styles.workflowBtn}
            />
          )}
        </Card>

        {/* ── eKYC ───────────────────────────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionTitle title="eKYC" />
          <DetailRow label="Current Status" value="—" />
          <DetailRow label="Completed By" value="—" />
          <DetailRow label="Completed Date & Time" value="—" isLast />
          <Text style={styles.helperText}>
            eKYC verification is performed in the Customer App during application
            submission.
          </Text>
        </Card>

        {/* ── eSign ──────────────────────────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionTitle title="eSign" />
          <DetailRow label="Current Status" value="—" />
          <DetailRow label="Completed By" value="—" />
          <DetailRow label="Completed Date & Time" value="—" isLast />
          <Text style={styles.helperText}>
            Agreement signing happens in the Customer App after the offer is accepted.
          </Text>
        </Card>

        {/* ── eMandate ───────────────────────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionTitle title="eMandate" />
          <DetailRow label="Current Status" value="—" />
          <DetailRow label="Completed By" value="—" />
          <DetailRow label="Completed Date & Time" value="—" isLast />
          <Text style={styles.helperText}>
            eMandate registration is handled by the Finance Portal.
          </Text>
        </Card>

        {/* ── Disbursement ───────────────────────────────────────────────── */}
        <Card style={styles.section}>
          <SectionTitle title="Disbursement" />
          <DetailRow label="Current Status" value="—" />
          <DetailRow label="Completed By" value="—" />
          <DetailRow label="Completed Date & Time" value="—" isLast />
          <Text style={styles.helperText}>
            Disbursement is handled by the Finance Portal.
          </Text>
        </Card>

        {/* ── Order (created by the backend after down payment) ──────────── */}
        <Card style={styles.section}>
          <SectionTitle title="Order" />
          <DetailRow label="Current Status" value={orderStatusLabel} />
          <DetailRow label="Order ID" value={order ? order.id : '—'} />
          <DetailRow
            label="Order Date"
            value={order ? formatDate(order.orderDate) : '—'}
            isLast
          />
          {order ? (
            <Button
              title="View Order"
              variant="outline"
              onPress={() => navigation.navigate('OrderDetails', { orderId: order.id })}
              style={styles.workflowBtn}
            />
          ) : (
            <Text style={styles.helperText}>
              Order is created automatically after the customer completes the down
              payment.
            </Text>
          )}
        </Card>

        {/* ── Dispatch (managed via the real order) ──────────────────────── */}
        <Card style={styles.section}>
          <SectionTitle title="Dispatch" />
          <DetailRow label="Current Status" value={orderStatusLabel} />
          <DetailRow label="Courier / Tracking" value="Tracked in Order Details" />
          <DetailRow label="Dispatched Date & Time" value="—" isLast />
          {order ? (
            <Button
              title="Manage Dispatch"
              variant="outline"
              onPress={() => navigation.navigate('OrderDetails', { orderId: order.id })}
              style={styles.workflowBtn}
            />
          ) : (
            <Text style={styles.helperText}>
              Dispatch is managed from the Order once it is created.
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textHeading },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  section: { marginBottom: spacing.md },
  workflowBtn: {
    marginTop: spacing.md,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  paymentHistory: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  paymentHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textHeading,
    marginBottom: spacing.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  paymentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  paymentDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rejectBox: {
    marginTop: spacing.md,
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 16, color: colors.textSecondary },
});
