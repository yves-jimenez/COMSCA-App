import { supabase } from '../lib/supabaseClient'

export type LoanStatus = 'APPROVED' | 'RELEASED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'

export type Loan = {
  id: number
  borrower_id: string
  principal_amount: string
  term_months: number | null
  service_charge_rate: string
  service_charge_amount: string
  status: LoanStatus
  approved_at: string
  released_at: string | null
  completed_at: string | null
  remarks: string | null
}

export type PaymentType = 'SERVICE_CHARGE' | 'PRINCIPAL'

export type LoanPayment = {
  id: number
  loan_id: number
  payment_date: string
  amount: string
  payment_type: PaymentType
  remarks: string | null
}

export type CreateLoanInput = {
  borrower_id: string
  principal_amount: number
  term_months?: number
  status?: LoanStatus
  remarks?: string
}

export type CreateLoanPaymentInput = {
  loan_id: number
  payment_type: PaymentType
  amount?: number
  payment_date?: string
  remarks?: string
}

export async function listLoans(): Promise<Loan[]> {
  const { data, error } = await supabase
    .from('loans')
    .select('id, borrower_id, principal_amount, term_months, service_charge_rate, service_charge_amount, status, approved_at, released_at, completed_at, remarks')
    .order('approved_at', { ascending: false })

  if (error) throw error
  return data as Loan[]
}

export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  const { data, error } = await supabase
    .from('loans')
    .insert({
      borrower_id: input.borrower_id,
      principal_amount: input.principal_amount,
      term_months: input.term_months ?? null,
      status: input.status ?? 'APPROVED',
      remarks: input.remarks ?? null,
    })
    .select('id, borrower_id, principal_amount, term_months, service_charge_rate, service_charge_amount, status, approved_at, released_at, completed_at, remarks')
    .single()

  if (error) throw error
  return data as Loan
}

export async function updateLoanStatus(loanId: number, status: LoanStatus): Promise<Loan> {
  const { data, error } = await supabase
    .from('loans')
    .update({ status })
    .eq('id', loanId)
    .select('id, borrower_id, principal_amount, term_months, service_charge_rate, service_charge_amount, status, approved_at, released_at, completed_at, remarks')
    .single()

  if (error) throw error
  return data as Loan
}

export async function deleteLoan(loanId: number): Promise<void> {
  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', loanId)

  if (error) throw error
}

export async function listLoanPayments(loanId: number): Promise<LoanPayment[]> {
  const { data, error } = await supabase
    .from('loan_payments')
    .select('id, loan_id, payment_date, amount, payment_type, remarks')
    .eq('loan_id', loanId)
    .order('payment_date', { ascending: true })

  if (error) throw error
  return data as LoanPayment[]
}

export async function createLoanPayment(input: CreateLoanPaymentInput): Promise<LoanPayment> {
  // Fetch the current loan to get its details
  const { data: loanData, error: loanError } = await supabase
    .from('loans')
    .select('principal_amount, service_charge_amount')
    .eq('id', input.loan_id)
    .single()

  if (loanError) throw loanError

  let paymentAmount: number

  // Determine payment amount based on payment type
  if (input.payment_type === 'SERVICE_CHARGE') {
    // Service charge payment is always the full service charge amount
    paymentAmount = Number(loanData.service_charge_amount || 0)
  } else {
    // Principal payment uses the provided amount
    if (!input.amount || input.amount <= 0) {
      throw new Error('Principal payment amount must be greater than 0')
    }
    paymentAmount = input.amount
  }

  // Create the payment record
  const { data, error } = await supabase
    .from('loan_payments')
    .insert({
      loan_id: input.loan_id,
      payment_type: input.payment_type,
      amount: paymentAmount,
      payment_date: input.payment_date ?? new Date().toISOString().slice(0, 10),
      remarks: input.remarks ?? null,
    })
    .select('id, loan_id, payment_date, amount, payment_type, remarks')
    .single()

  if (error) throw error

  // Only reduce principal for PRINCIPAL payments
  if (input.payment_type === 'PRINCIPAL') {
    const currentPrincipal = Number(loanData.principal_amount || 0)
    const newPrincipal = Math.max(0, currentPrincipal - paymentAmount)

    // Update the loan's principal amount
    const { error: updateError } = await supabase
      .from('loans')
      .update({ principal_amount: newPrincipal })
      .eq('id', input.loan_id)

    if (updateError) throw updateError

    // Auto-update status to COMPLETED if principal reaches 0
    if (newPrincipal === 0) {
      const { error: statusError } = await supabase
        .from('loans')
        .update({ status: 'COMPLETED' })
        .eq('id', input.loan_id)

      if (statusError) throw statusError
    }
  }

  return data as LoanPayment
}

export function computeLoanBalance(
  loan: Loan,
): number {
  const principal = Number(loan.principal_amount || 0)
  const serviceCharge = Number(loan.service_charge_amount || 0)
  return principal + serviceCharge
}

export function computeTotalPayments(payments: LoanPayment[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
}
