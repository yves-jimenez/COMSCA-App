import { useEffect, useMemo, useState } from 'react'
import { type Member, listMembers, createMember } from './api/members'
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
} from './api/loans'
import {
  type YearEndDistribution,
  computeYearEndDistribution,
  clearYearData,
} from './api/yearEnd'
import { YearEndModal } from './components/YearEndModal'
import { YearEndReport } from './components/YearEndReport'

const SHARE_VALUE = 250 // pesos per share

type Screen = 'dashboard' | 'members' | 'loans'

function App() {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [loans, setLoans] = useState<Loan[]>([])
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null)
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([])

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
  const [loanTermMonths, setLoanTermMonths] = useState('')

  // Loan payment form state
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

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  )

  const selectedLoan = useMemo(
    () => loans.find((l) => l.id === selectedLoanId) ?? null,
    [loans, selectedLoanId],
  )

  const selectedLoanBalance = useMemo(
    () => (selectedLoan ? computeLoanBalance(selectedLoan, loanPayments) : 0),
    [selectedLoan, loanPayments],
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
  const totalServiceCharge = loans.reduce(
    (sum, l) => sum + Number(l.service_charge_amount || 0),
    0,
  )
  const totalContributions = totalSharesValue + totalSocialFund

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberName.trim()) return

    setLoading(true)
    setError(null)
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
    } catch (err: any) {
      setError(err.message ?? 'Failed to create member')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddContribution(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMemberId) return

    setLoading(true)
    setError(null)
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
      } else {
        const amountNumber = Number(socialFundAmount)
        if (!Number.isFinite(amountNumber) || amountNumber <= 0) return
        await createContribution({
          member_id: selectedMemberId,
          type: 'SOCIAL_FUND',
          amount: amountNumber,
        })
      }

      await refreshAll()
      setShareCount('')
      setSocialFundAmount('')
    } catch (err: any) {
      setError(err.message ?? 'Failed to create contribution')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMemberId) return
    const principal = Number(loanAmount)
    const term = loanTermMonths ? Number(loanTermMonths) : undefined
    if (!Number.isFinite(principal) || principal <= 0) return

    setLoading(true)
    setError(null)
    try {
      const loan = await createLoan({
        borrower_id: selectedMemberId,
        principal_amount: principal,
        term_months: term,
      })
      setLoans((prev) => [loan, ...prev])
      setLoanAmount('')
      setLoanTermMonths('')
    } catch (err: any) {
      setError(err.message ?? 'Failed to create loan')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLoanId) return
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) return

    setLoading(true)
    setError(null)
    try {
      await createLoanPayment({
        loan_id: selectedLoanId,
        amount,
        payment_date: paymentDate || undefined,
        remarks: paymentRemarks || undefined,
      })
      const payments = await listLoanPayments(selectedLoanId)
      setLoanPayments(payments)
      setPaymentAmount('')
      setPaymentDate('')
      setPaymentRemarks('')
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
      // Record penalty as a positive amount with "Attendance penalty" remarks
      // The UI will treat this as a deduction from social fund
      await createContribution({
        member_id: selectedMemberId,
        type: 'SOCIAL_FUND',
        amount,
        remarks: 'Attendance penalty',
      })
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

  function renderDashboard() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm font-medium">Total Shares (Pesos)</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              ₱{totalSharesValue.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium">Total Social Fund</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              ₱{totalSocialFund.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm font-medium">Total Contributions</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              ₱{totalContributions.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <p className="text-gray-600 text-sm font-medium">Service Charge Earnings</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              ₱{totalServiceCharge.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Year-End Operations</h2>
          <button
            type="button"
            onClick={handleYearEndClick}
            disabled={yearEndLoading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            {yearEndLoading ? 'Processing...' : 'Year-End Reset'}
          </button>
        </div>
      </div>
    )
  }

  function renderMembersScreen() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Members</h2>
          <form onSubmit={handleCreateMember} className="space-y-3 mb-6">
            <input
              type="text"
              placeholder="Full name"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Contact info"
              value={newMemberContact}
              onChange={(e) => setNewMemberContact(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
            >
              Add Member
            </button>
          </form>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMemberId(m.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition ${
                  m.id === selectedMemberId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <div className="font-semibold">{m.full_name}</div>
                <div className="text-sm opacity-75">Joined {m.join_date}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Member Details & Forms */}
        <div className="lg:col-span-2 space-y-6">
          {selectedMember ? (
            <>
              {/* Member Summary */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  {selectedMember.full_name}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600 text-sm">Contact</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {selectedMember.contact_info || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Total Shares (Pesos)</p>
                    <p className="text-lg font-semibold text-blue-600">
                      ₱{selectedMember.total_shares}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Social Fund</p>
                    <p className="text-lg font-semibold text-green-600">
                      ₱{selectedMember.total_social_fund_contributions}
                    </p>
                  </div>
                </div>
              </div>

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
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Term (months, optional)
                    </label>
                    <input
                      type="number"
                      placeholder="Term (months, optional)"
                      value={loanTermMonths}
                      onChange={(e) => setLoanTermMonths(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
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
                    This will be deducted from the member's social fund as an attendance penalty.
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
        </div>
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
                    ? 'bg-blue-600 text-white'
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
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Loan #{selectedLoan.id}
                </h2>
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
                      ₱{selectedLoan.service_charge_amount}
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
                <div>
                  <p className="text-gray-600 text-sm">Status</p>
                  <p className="text-lg font-semibold text-gray-800">{selectedLoan.status}</p>
                </div>
              </div>

              {/* Add Payment */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Record Payment</h3>
                <form onSubmit={handleAddPayment} className="space-y-4">
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
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">COMSCA Admin</h1>
            <nav className="flex gap-2">
              <button
                type="button"
                onClick={() => setScreen('dashboard')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  screen === 'dashboard'
                    ? 'bg-white text-blue-600'
                    : 'bg-blue-700 hover:bg-blue-600 text-white'
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setScreen('members')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  screen === 'members'
                    ? 'bg-white text-blue-600'
                    : 'bg-blue-700 hover:bg-blue-600 text-white'
                }`}
              >
                Members
              </button>
              <button
                type="button"
                onClick={() => setScreen('loans')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  screen === 'loans'
                    ? 'bg-white text-blue-600'
                    : 'bg-blue-700 hover:bg-blue-600 text-white'
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
    </div>
  )
}

export default App
