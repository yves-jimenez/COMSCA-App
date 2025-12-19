import { useEffect, useMemo, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from './lib/supabaseClient'
import { type Member, listMembers, createMember, updateMember } from './api/members'
import {
  type ContributionType,
  createContribution,
} from './api/contributions'
import {
  createLoan,
  listLoans,
  type Loan,
  listLoanPayments,
  type LoanPayment,
  createLoanPayment,
  computeLoanBalance,
  computeTotalPayments,
  updateLoanStatus,
  deleteLoan,
  type LoanStatus,
  type PaymentType,
} from './api/loans'
import {
  type YearEndDistribution,
  computeYearEndDistribution,
  clearYearData,
} from './api/yearEnd'
import { YearEndModal } from './components/YearEndModal'
import { YearEndReport } from './components/YearEndReport'

const SHARE_VALUE = 500 // pesos per share

type Screen = 'dashboard' | 'members' | 'loans'

function App() {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [loans, setLoans] = useState<Loan[]>([])
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null)
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([])
  const [allLoanPayments, setAllLoanPayments] = useState<LoanPayment[]>([])

  const [screen, setScreen] = useState<Screen>('dashboard')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Member form state
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberContact, setNewMemberContact] = useState('')

  // Contribution form state
  const [contributionType, setContributionType] = useState<ContributionType>('SHARE')
  const [shareCount, setShareCount] = useState('')
  const [socialFundAmount, setSocialFundAmount] = useState('')

  // Loan form state
  const [loanAmount, setLoanAmount] = useState('')
  const [previewServiceCharge, setPreviewServiceCharge] = useState(0)

  // Loan payment form state
  const [paymentType, setPaymentType] = useState<PaymentType>('PRINCIPAL')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentRemarks, setPaymentRemarks] = useState('')

  // Attendance penalty form state
  const [penaltyAmount, setPenaltyAmount] = useState('')

  // Year-end modal state
  const [yearEndModalOpen, setYearEndModalOpen] = useState(false)
  const [yearEndDistribution, setYearEndDistribution] =
    useState<YearEndDistribution | null>(null)
  const [yearEndLoading, setYearEndLoading] = useState(false)
  const [yearEndReportOpen, setYearEndReportOpen] = useState(false)

  // Member edit state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editMemberName, setEditMemberName] = useState('')
  const [editMemberContact, setEditMemberContact] = useState('')
  const [editMemberRecordId, setEditMemberRecordId] = useState('')

  // Ref for scrollable member details container
  const memberDetailsScrollRef = useRef<HTMLDivElement>(null)

  // Add member modal state
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false)

  // Outstanding loans breakdown modal state
  const [outstandingLoansBreakdownOpen, setOutstandingLoansBreakdownOpen] = useState(false)

  // Notification state
  type NotificationType = 'success' | 'error' | 'info'
  interface Notification {
    id: string
    type: NotificationType
    message: string
  }
  const [notifications, setNotifications] = useState<Notification[]>([])

  function showNotification(type: NotificationType, message: string) {
    const id = Date.now().toString()
    setNotifications((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 4000)
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  async function refreshAll() {
    setLoading(true)
    setError(null)
    try {
      const [membersData, loansData] = await Promise.all([
        listMembers(),
        listLoans(),
      ])
      setMembers(membersData)
      setLoans(loansData)
      if (!selectedMemberId && membersData.length > 0) {
        setSelectedMemberId(membersData[0].id)
      }
      if (selectedLoanId) {
        const payments = await listLoanPayments(selectedLoanId)
        setLoanPayments(payments)
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Fetch all loan payments when loans change
  useEffect(() => {
    const fetchAllPayments = async () => {
      if (loans.length === 0) {
        setAllLoanPayments([])
        return
      }
      try {
        const allPayments: LoanPayment[] = []
        for (const loan of loans) {
          const payments = await listLoanPayments(loan.id)
          allPayments.push(...payments)
        }
        setAllLoanPayments(allPayments)
      } catch {
        setAllLoanPayments([])
      }
    }
    void fetchAllPayments()
  }, [loans])

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  )

  const selectedLoan = useMemo(
    () => loans.find((l) => l.id === selectedLoanId) ?? null,
    [loans, selectedLoanId],
  )

  const selectedLoanBalance = useMemo(
    () => (selectedLoan ? computeLoanBalance(selectedLoan) : 0),
    [selectedLoan],
  )

  // Aggregated totals for dashboard
  const totalSharesValue = members.reduce(
    (sum, m) => sum + Number(m.total_shares || 0),
    0,
  )
  const totalSocialFund = members.reduce(
    (sum, m) => sum + Number(m.total_social_fund_contributions || 0),
    0,
  )
  const totalPenalties = members.reduce(
    (sum, m) => sum + Number(m.total_penalties || 0),
    0,
  )
  const totalContributions = totalSharesValue + totalSocialFund
  
  // Calculate service charge earnings (only PAID service charges)
  const totalServiceChargeEarnings = loans.reduce((sum, loan) => {
    const loanPaymentsForLoan = allLoanPayments.filter(p => p.loan_id === loan.id)
    const paidServiceCharges = loanPaymentsForLoan
      .filter(p => p.payment_type === 'SERVICE_CHARGE')
      .reduce((acc, p) => acc + Number(p.amount || 0), 0)
    return sum + paidServiceCharges
  }, 0)
  
  // Calculate outstanding loan balance (unpaid principal + unpaid service charges)
  const totalOutstandingLoans = loans.reduce((sum, loan) => {
    const loanPaymentsForLoan = allLoanPayments.filter(p => p.loan_id === loan.id)
    
    // Calculate unpaid principal
    const principalPayments = loanPaymentsForLoan
      .filter(p => p.payment_type === 'PRINCIPAL')
      .reduce((acc, p) => acc + Number(p.amount || 0), 0)
    const unpaidPrincipal = Math.max(0, Number(loan.principal_amount || 0) - principalPayments)
    
    // Calculate unpaid service charge
    const serviceChargePayments = loanPaymentsForLoan
      .filter(p => p.payment_type === 'SERVICE_CHARGE')
      .reduce((acc, p) => acc + Number(p.amount || 0), 0)
    const unpaidServiceCharge = Math.max(0, Number(loan.service_charge_amount || 0) - serviceChargePayments)
    
    return sum + unpaidPrincipal + unpaidServiceCharge
  }, 0)
  
  // Grand total cash on hand = contributions + service charge earnings - outstanding loans
  const grandTotalCashOnHand = totalContributions + totalServiceChargeEarnings - totalOutstandingLoans

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberName.trim()) return

    setLoading(true)
    try {
      const member = await createMember({
        full_name: newMemberName.trim(),
        contact_info: newMemberContact.trim() || undefined,
      })
      setMembers((prev) => [...prev, member])
      setNewMemberName('')
      setNewMemberContact('')
      if (!selectedMemberId) {
        setSelectedMemberId(member.id)
      }
      showNotification('success', `Member "${member.full_name}" added successfully`)
    } catch (err: any) {
      showNotification('error', err.message ?? 'Failed to create member')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddContribution(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMemberId) return

    setLoading(true)
    try {
      if (contributionType === 'SHARE') {
        const shares = Number(shareCount)
        if (!Number.isFinite(shares) || shares <= 0) return
        const amount = shares * SHARE_VALUE
        await createContribution({
          member_id: selectedMemberId,
          type: 'SHARE',
          amount,
        })
        showNotification('success', `${shares} share(s) added successfully (₱${amount})`)
      } else {
        const amountNumber = Number(socialFundAmount)
        if (!Number.isFinite(amountNumber) || amountNumber <= 0) return
        await createContribution({
          member_id: selectedMemberId,
          type: 'SOCIAL_FUND',
          amount: amountNumber,
        })
        showNotification('success', `Social fund contribution of ₱${amountNumber} added successfully`)
      }

      await refreshAll()
      setShareCount('')
      setSocialFundAmount('')
    } catch (err: any) {
      showNotification('error', err.message ?? 'Failed to create contribution')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMemberId) return
    const principal = Number(loanAmount)
    if (!Number.isFinite(principal) || principal <= 0) return

    setLoading(true)
    try {
      const loan = await createLoan({
        borrower_id: selectedMemberId,
        principal_amount: principal,
      })
      setLoans((prev) => [loan, ...prev])
      setLoanAmount('')
      const serviceCharge = Number(loan.service_charge_amount || 0)
      showNotification('success', `Loan created successfully (Principal: ₱${principal}, Service Charge: ₱${serviceCharge.toFixed(2)})`)
    } catch (err: any) {
      showNotification('error', err.message ?? 'Failed to create loan')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLoanId) return

    setLoading(true)
    setError(null)
    try {
      let amount: number | undefined
      if (paymentType === 'PRINCIPAL') {
        amount = Number(paymentAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          setError('Principal payment amount must be greater than 0')
          setLoading(false)
          return
        }
      }

      await createLoanPayment({
        loan_id: selectedLoanId,
        payment_type: paymentType,
        amount,
        payment_date: paymentDate || undefined,
        remarks: paymentRemarks || undefined,
      })
      // Refresh loans to get updated principal and service charge from database
      const loansData = await listLoans()
      setLoans(loansData)
      const payments = await listLoanPayments(selectedLoanId)
      setLoanPayments(payments)
      setPaymentAmount('')
      setPaymentDate('')
      setPaymentRemarks('')
      showNotification('success', `${paymentType === 'SERVICE_CHARGE' ? 'Service charge' : 'Principal'} payment recorded successfully`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to add payment')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectLoan(loanId: number) {
    setSelectedLoanId(loanId)
    setLoading(true)
    try {
      const payments = await listLoanPayments(loanId)
      setLoanPayments(payments)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load loan payments')
    } finally {
      setLoading(false)
    }
  }

  async function handleYearEndClick() {
    setYearEndLoading(true)
    setError(null)
    try {
      const distribution = await computeYearEndDistribution(members, loans)
      setYearEndDistribution(distribution)
      setYearEndModalOpen(true)
    } catch (err: any) {
      setError(err.message ?? 'Failed to compute year-end distribution')
    } finally {
      setYearEndLoading(false)
    }
  }

  async function handleYearEndConfirm() {
    setYearEndLoading(true)
    setError(null)
    try {
      await clearYearData()
      setYearEndModalOpen(false)
      // Keep the distribution data to show in the report
      setYearEndReportOpen(true)
      setSelectedLoanId(null)
      setLoanPayments([])
      await refreshAll()
    } catch (err: any) {
      setError(err.message ?? 'Failed to clear year data')
    } finally {
      setYearEndLoading(false)
    }
  }

  function handleYearEndCancel() {
    setYearEndModalOpen(false)
    setYearEndDistribution(null)
  }

  async function handleRecordPenalty(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMemberId) return
    const amount = Number(penaltyAmount)
    if (!Number.isFinite(amount) || amount <= 0) return

    setLoading(true)
    setError(null)
    try {
      // Get current member data
      const member = members.find((m) => m.id === selectedMemberId)
      if (!member) throw new Error('Member not found')

      const currentPenalties = Number(member.total_penalties || 0)
      const newPenalties = currentPenalties + amount

      // Update member's total_penalties
      const { error } = await supabase
        .from('members')
        .update({ total_penalties: newPenalties })
        .eq('id', selectedMemberId)

      if (error) throw error
      await refreshAll()
      setPenaltyAmount('')
    } catch (err: any) {
      setError(err.message ?? 'Failed to record penalty')
    } finally {
      setLoading(false)
    }
  }

  // Helper to get member name by ID
  function getMemberName(memberId: string): string {
    return members.find((m) => m.id === memberId)?.full_name ?? 'Unknown'
  }

  async function handleDeleteLoan(loanId: number) {
    const loan = loans.find((l) => l.id === loanId)
    if (!loan) return

    const borrowerName = getMemberName(loan.borrower_id)
    const confirmMessage = `Delete Loan #${loanId}?\n\nBorrower: ${borrowerName}\nPrincipal: ₱${loan.principal_amount}\nStatus: ${loan.status}\n\nThis action cannot be undone.`

    if (!window.confirm(confirmMessage)) return

    setLoading(true)
    setError(null)
    try {
      await deleteLoan(loanId)
      setLoans((prev) => prev.filter((l) => l.id !== loanId))
      setSelectedLoanId(null)
      setLoanPayments([])
      showNotification('success', `Loan #${loanId} deleted successfully`)
    } catch (err: any) {
      showNotification('error', err.message ?? 'Failed to delete loan')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateLoanStatus(loanId: number, newStatus: LoanStatus) {
    setLoading(true)
    setError(null)
    try {
      const updatedLoan = await updateLoanStatus(loanId, newStatus)
      setLoans((prev) =>
        prev.map((l) => (l.id === loanId ? updatedLoan : l))
      )
    } catch (err: any) {
      setError(err.message ?? 'Failed to update loan status')
    } finally {
      setLoading(false)
    }
  }

  async function handleEditMember(e: React.FormEvent) {
    e.preventDefault()
    if (!editingMemberId || !editMemberName.trim()) return

    setLoading(true)
    setError(null)
    try {
      const updatedMember = await updateMember(editingMemberId, {
        full_name: editMemberName.trim(),
        contact_info: editMemberContact.trim() || undefined,
      })
      setMembers((prev) =>
        prev.map((m) => (m.id === editingMemberId ? updatedMember : m))
      )
      setEditingMemberId(null)
      setEditMemberName('')
      setEditMemberContact('')
    } catch (err: any) {
      setError(err.message ?? 'Failed to update member')
    } finally {
      setLoading(false)
    }
  }

  function startEditMember(member: Member) {
    setEditingMemberId(member.id)
    setEditMemberName(member.full_name)
    setEditMemberContact(member.contact_info || '')
  }

  function cancelEditMember() {
    setEditingMemberId(null)
    setEditMemberName('')
    setEditMemberContact('')
  }

  function renderDashboard() {
    const cardVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.5 },
      }),
    }

    return (
      <motion.div className="space-y-6" initial="hidden" animate="visible">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Shares (Pesos)', value: totalSharesValue, color: 'blue' },
            { label: 'Total Social Fund', value: totalSocialFund, color: 'green' },
            { label: 'Total Contributions', value: totalContributions, color: 'purple' },
            { label: 'Service Charge Earnings', value: totalServiceChargeEarnings, color: 'green' },
            { label: 'Total Penalties', value: totalPenalties, color: 'red' },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              custom={i}
              variants={cardVariants}
              whileHover={{ scale: 1.05, y: -5 }}
              className={`bg-white rounded-lg shadow p-6 border-l-4 border-${card.color}-500`}
            >
              <div>
                <p className="text-gray-600 text-sm font-medium">{card.label}</p>
                <p className={`text-3xl font-bold text-${card.color}-600 mt-2`}>
                  ₱{card.value.toFixed(2)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          custom={5}
          variants={cardVariants}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-lg shadow p-8 text-white"
        >
          <p className="text-lg font-medium opacity-90">Grand Total Cash on Hand</p>
          <p className="text-5xl font-bold mt-3">
            ₱{grandTotalCashOnHand.toFixed(2)}
          </p>
          <p className="text-sm opacity-75 mt-2">
            Contributions + Service Charges - Outstanding Loans
          </p>
        </motion.div>

        <motion.div
          custom={6}
          variants={cardVariants}
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg shadow p-8 text-white cursor-pointer"
          onClick={() => setOutstandingLoansBreakdownOpen(true)}
        >
          <p className="text-lg font-medium opacity-90">Outstanding Loans</p>
          <p className="text-5xl font-bold mt-3">
            ₱{totalOutstandingLoans.toFixed(2)}
          </p>
          <p className="text-sm opacity-75 mt-2">
            Click to view breakdown
          </p>
        </motion.div>

        <motion.div
          custom={7}
          variants={cardVariants}
          whileHover={{ scale: 1.02 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Operations</h2>
          <div className="flex gap-4">
            <motion.button
              type="button"
              onClick={handleYearEndClick}
              disabled={yearEndLoading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              {yearEndLoading ? 'Processing...' : 'Year-End Distribution'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  function renderMembersScreen() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Members List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-1 bg-white rounded-lg shadow-lg p-6 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Members</h2>
            <motion.button
              type="button"
              onClick={() => setAddMemberModalOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              + Add
            </motion.button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {members.map((m, index) => (
              <motion.button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMemberId(m.id)
                  memberDetailsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  m.id === selectedMemberId
                    ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">#{m.record_id} - {m.full_name}</div>
                    <div className="text-xs opacity-75">Joined {m.join_date}</div>
                  </div>
                  {m.id === selectedMemberId && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-2 text-lg"
                    >
                      ▼
                    </motion.div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Member Details & Forms */}
        <motion.div
          ref={memberDetailsScrollRef}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-2 space-y-6 overflow-y-auto pr-2"
        >
          {selectedMember ? (
            <>
              {/* Member Summary */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-lg shadow-lg p-6"
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  {editingMemberId === selectedMember.id ? (
                    <motion.form
                      onSubmit={handleEditMember}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                        <label className="block text-gray-700 font-semibold mb-2">Record ID</label>
                        <input
                          type="number"
                          value={editMemberRecordId}
                          onChange={(e) => setEditMemberRecordId(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-semibold mb-2">Full Name</label>
                        <input
                          type="text"
                          value={editMemberName}
                          onChange={(e) => setEditMemberName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-semibold mb-2">Contact Info</label>
                        <input
                          type="text"
                          value={editMemberContact}
                          onChange={(e) => setEditMemberContact(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <motion.button
                          type="submit"
                          disabled={loading}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-2 rounded-lg transition shadow-md"
                        >
                          Save Changes
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={cancelEditMember}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 rounded-lg transition shadow-md"
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="text-3xl font-bold text-gray-800">
                            {selectedMember.full_name}
                          </h2>
                          <p className="text-sm text-gray-500 mt-1">Record ID: #{selectedMember.record_id}</p>
                        </div>
                        <motion.button
                          type="button"
                          onClick={() => startEditMember(selectedMember)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 px-6 rounded-lg transition shadow-md"
                        >
                          ✎ Edit
                        </motion.button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <motion.div
                          whileHover={{ y: -4 }}
                          className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200 shadow-sm hover:shadow-md transition"
                        >
                          <p className="text-gray-600 text-sm font-medium">Contact</p>
                          <p className="text-lg font-semibold text-gray-800 mt-2">
                            {selectedMember.contact_info || '—'}
                          </p>
                        </motion.div>
                        <motion.div
                          whileHover={{ y: -4 }}
                          className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200 shadow-sm hover:shadow-md transition"
                        >
                          <p className="text-gray-600 text-sm font-medium">Total Shares (Pesos)</p>
                          <p className="text-lg font-semibold text-blue-600 mt-2">
                            ₱{selectedMember.total_shares}
                          </p>
                        </motion.div>
                        <motion.div
                          whileHover={{ y: -4 }}
                          className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200 shadow-sm hover:shadow-md transition"
                        >
                          <p className="text-gray-600 text-sm font-medium">Social Fund</p>
                          <p className="text-lg font-semibold text-green-600 mt-2">
                            ₱{selectedMember.total_social_fund_contributions}
                          </p>
                        </motion.div>
                        <motion.div
                          whileHover={{ y: -4 }}
                          className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200 shadow-sm hover:shadow-md transition"
                        >
                          <p className="text-gray-600 text-sm font-medium">Total Penalties</p>
                          <p className="text-lg font-semibold text-red-600 mt-2">
                            ₱{selectedMember.total_penalties}
                          </p>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>

              {/* Add Contribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Add Contribution</h3>
                <form onSubmit={handleAddContribution} className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Type</label>
                    <select
                      value={contributionType}
                      onChange={(e) =>
                        setContributionType(e.target.value as ContributionType)
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="SHARE">Share (by number of shares)</option>
                      <option value="SOCIAL_FUND">Social Fund (peso amount)</option>
                    </select>
                  </div>

                  {contributionType === 'SHARE' ? (
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        Number of shares (1 share = ₱{SHARE_VALUE})
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Number of shares"
                        value={shareCount}
                        onChange={(e) => setShareCount(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        Social fund amount (pesos)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={socialFundAmount}
                        onChange={(e) => setSocialFundAmount(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
                  >
                    Add Contribution
                  </button>
                </form>
              </div>

              {/* Create Loan */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Create Loan</h3>
                <form onSubmit={handleCreateLoan} className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Principal amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Principal amount"
                      value={loanAmount}
                      onChange={(e) => {
                        setLoanAmount(e.target.value)
                        const amount = Number(e.target.value)
                        setPreviewServiceCharge(Number.isFinite(amount) && amount > 0 ? Math.round(amount * 0.02 * 100) / 100 : 0)
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">Monthly service charge preview (2%):</p>
                    <p className="text-2xl font-bold text-green-700">
                      ₱{previewServiceCharge.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    Service charge is calculated monthly on the current balance
                  </p>
                  <button
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition"
                  >
                    Create Loan
                  </button>
                </form>
              </div>

              {/* Record Attendance Penalty */}
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Record Attendance Penalty</h3>
                <form onSubmit={handleRecordPenalty} className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Penalty amount (pesos)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Penalty amount"
                      value={penaltyAmount}
                      onChange={(e) => setPenaltyAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    Penalty for non-attendance to meetings.
                  </p>
                  <button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition"
                  >
                    Record Penalty
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
              Select a member to see details
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  function renderLoansScreen() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loans List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Loans</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loans.map((loan) => (
              <button
                key={loan.id}
                type="button"
                onClick={() => handleSelectLoan(loan.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition ${
                  loan.id === selectedLoanId
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <div className="font-semibold">Loan #{loan.id}</div>
                <div className="text-sm opacity-75">
                  Borrower: {getMemberName(loan.borrower_id)}
                </div>
                <div className="text-sm opacity-75">
                  Principal: ₱{loan.principal_amount}
                </div>
                <div className="text-sm opacity-75">Status: {loan.status}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Loan Details & Payments */}
        <div className="lg:col-span-2 space-y-6">
          {selectedLoan ? (
            <>
              {/* Loan Summary */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">
                    Loan #{selectedLoan.id}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteLoan(selectedLoan.id)}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-gray-600 text-sm">Principal</p>
                    <p className="text-lg font-semibold text-gray-800">
                      ₱{selectedLoan.principal_amount}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Service Charge (2%)</p>
                    <p className="text-lg font-semibold text-orange-600">
                      ₱{Number(selectedLoan.service_charge_amount || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Total Paid</p>
                    <p className="text-lg font-semibold text-green-600">
                      ₱{computeTotalPayments(loanPayments).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Outstanding Balance</p>
                    <p className={`text-lg font-semibold ${
                      selectedLoanBalance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      ₱{selectedLoanBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-600 text-sm mb-2">Status</p>
                    <div className="flex gap-2 items-center">
                      <p className="text-lg font-semibold text-gray-800">{selectedLoan.status}</p>
                      <select
                        value={selectedLoan.status}
                        onChange={(e) => handleUpdateLoanStatus(selectedLoan.id, e.target.value as LoanStatus)}
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="APPROVED">APPROVED</option>
                        <option value="RELEASED">RELEASED</option>
                        <option value="ONGOING">ONGOING</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Payment */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Record Payment</h3>
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Payment Type
                    </label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PRINCIPAL">Principal Payment</option>
                      <option value="SERVICE_CHARGE">Service Charge Payment</option>
                    </select>
                  </div>

                  {paymentType === 'PRINCIPAL' && (
                    <div>
                      <label className="block text-gray-700 font-semibold mb-2">
                        Payment amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {paymentType === 'SERVICE_CHARGE' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-2">Service Charge Amount:</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ₱{Number(selectedLoan?.service_charge_amount || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">This amount will be recorded as the service charge payment</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Payment date (optional)
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Remarks (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Remarks"
                      value={paymentRemarks}
                      onChange={(e) => setPaymentRemarks(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
                  >
                    Record Payment
                  </button>
                </form>
              </div>

              {/* Payment History */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Payment History</h3>
                {loanPayments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">
                            Type
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">
                            Amount
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {loanPayments.map((payment) => (
                          <tr key={payment.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-800">{payment.payment_date}</td>
                            <td className="px-4 py-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                payment.payment_type === 'SERVICE_CHARGE'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {payment.payment_type === 'SERVICE_CHARGE' ? 'Service Charge' : 'Principal'}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-semibold text-green-600">
                              ₱{Number(payment.amount).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-gray-600">
                              {payment.remarks || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-4">No payments recorded yet</p>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
              Select a loan to see details and record payments
            </div>
          )}
        </div>
      </div>
    )
  }

  let content: React.ReactNode
  if (screen === 'dashboard') {
    content = renderDashboard()
  } else if (screen === 'members') {
    content = renderMembersScreen()
  } else {
    content = renderLoansScreen()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-100 text-gray-800 shadow-sm border-b-4 border-green-300">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img 
                src="/Logo.png" 
                alt="COMSCA Logo" 
                className="h-16 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-green-700">COMSCAibigan Admin</h1>
                <p className="text-green-600 text-xs">Cooperative Management System</p>
              </div>
            </div>
            <nav className="flex gap-2">
              <button
                type="button"
                onClick={() => setScreen('dashboard')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  screen === 'dashboard'
                    ? 'bg-white text-green-700'
                    : 'bg-green-200 hover:bg-green-300 text-green-700'
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setScreen('members')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  screen === 'members'
                    ? 'bg-white text-green-700'
                    : 'bg-green-200 hover:bg-green-300 text-green-700'
                }`}
              >
                Members
              </button>
              <button
                type="button"
                onClick={() => setScreen('loans')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  screen === 'loans'
                    ? 'bg-white text-green-700'
                    : 'bg-green-200 hover:bg-green-300 text-green-700'
                }`}
              >
                Loans
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {loading && (
          <div className="mb-6 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg text-center">
            Loading...
          </div>
        )}

        {content}
      </main>

      {/* Year-End Modal */}
      <YearEndModal
        distribution={yearEndDistribution}
        isOpen={yearEndModalOpen}
        isLoading={yearEndLoading}
        onConfirm={handleYearEndConfirm}
        onCancel={handleYearEndCancel}
      />

      {/* Year-End Report */}
      <YearEndReport
        distribution={yearEndDistribution}
        isOpen={yearEndReportOpen}
        onClose={() => setYearEndReportOpen(false)}
      />

      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3 }}
            className={`px-6 py-3 rounded-lg shadow-lg font-semibold text-white max-w-sm ${
              notification.type === 'success'
                ? 'bg-green-600'
                : notification.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
            }`}
          >
            {notification.message}
          </motion.div>
        ))}
      </div>

      {/* Add Member Modal */}
      {addMemberModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40"
          onClick={() => setAddMemberModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Member</h2>
            <form onSubmit={(e) => {
              handleCreateMember(e)
              setAddMemberModalOpen(false)
            }} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter member's full name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Contact Info</label>
                <input
                  type="text"
                  placeholder="Enter contact information"
                  value={newMemberContact}
                  onChange={(e) => setNewMemberContact(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-2 rounded-lg transition"
                >
                  {loading ? 'Adding...' : 'Add Member'}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setAddMemberModalOpen(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition"
                >
                  Cancel
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Outstanding Loans Breakdown Modal */}
      {outstandingLoansBreakdownOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4"
          onClick={() => setOutstandingLoansBreakdownOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Outstanding Loans Breakdown</h2>
              <button
                type="button"
                onClick={() => setOutstandingLoansBreakdownOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {loans.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No loans found</p>
            ) : (
              <div className="space-y-4">
                {loans.filter(loan => loan.status !== 'COMPLETED').map((loan) => {
                  const loanPaymentsForLoan = allLoanPayments.filter(p => p.loan_id === loan.id)
                  
                  const principalPayments = loanPaymentsForLoan
                    .filter(p => p.payment_type === 'PRINCIPAL')
                    .reduce((acc, p) => acc + Number(p.amount || 0), 0)
                  const unpaidPrincipal = Math.max(0, Number(loan.principal_amount || 0) - principalPayments)
                  
                  const serviceChargePayments = loanPaymentsForLoan
                    .filter(p => p.payment_type === 'SERVICE_CHARGE')
                    .reduce((acc, p) => acc + Number(p.amount || 0), 0)
                  const unpaidServiceCharge = Math.max(0, Number(loan.service_charge_amount || 0) - serviceChargePayments)
                  
                  const totalOutstanding = unpaidPrincipal + unpaidServiceCharge

                  return (
                    <div key={loan.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-800">Loan #{loan.id}</h3>
                          <p className="text-sm text-gray-600">{getMemberName(loan.borrower_id)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600">₱{totalOutstanding.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{loan.status}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-blue-50 rounded p-3">
                          <p className="text-gray-600 text-xs font-medium">Unpaid Principal</p>
                          <p className="text-lg font-semibold text-blue-600 mt-1">₱{unpaidPrincipal.toFixed(2)}</p>
                          <p className="text-xs text-gray-500 mt-1">of ₱{Number(loan.principal_amount).toFixed(2)}</p>
                        </div>
                        <div className="bg-orange-50 rounded p-3">
                          <p className="text-gray-600 text-xs font-medium">Unpaid Service Charge</p>
                          <p className="text-lg font-semibold text-orange-600 mt-1">₱{unpaidServiceCharge.toFixed(2)}</p>
                          <p className="text-xs text-gray-500 mt-1">of ₱{Number(loan.service_charge_amount || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {loans.filter(loan => loan.status === 'COMPLETED').length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-green-700 font-medium">
                      {loans.filter(loan => loan.status === 'COMPLETED').length} completed loan(s) not shown
                    </p>
                  </div>
                )}
                
                <div className="border-t-2 border-gray-300 pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-gray-800">Total Outstanding</p>
                    <p className="text-2xl font-bold text-red-600">₱{totalOutstandingLoans.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6 mt-6 border-t">
              <motion.button
                type="button"
                onClick={() => setOutstandingLoansBreakdownOpen(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default App
