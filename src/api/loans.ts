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

export type LoanPayment = {
  id: number
  loan_id: number
  payment_date: string
  amount: string
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
  amount: number
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

export async function listLoanPayments(loanId: number): Promise<LoanPayment[]> {
  const { data, error } = await supabase
    .from('loan_payments')
    .select('id, loan_id, payment_date, amount, remarks')
    .eq('loan_id', loanId)
    .order('payment_date', { ascending: true })

  if (error) throw error
  return data as LoanPayment[]
}

export async function createLoanPayment(input: CreateLoanPaymentInput): Promise<LoanPayment> {
  const { data, error } = await supabase
    .from('loan_payments')
    .insert({
      loan_id: input.loan_id,
      amount: input.amount,
      payment_date: input.payment_date ?? new Date().toISOString().slice(0, 10),
      remarks: input.remarks ?? null,
    })
    .select('id, loan_id, payment_date, amount, remarks')
    .single()

  if (error) throw error
  return data as LoanPayment
}

export function computeLoanBalance(
  loan: Loan,
  payments: LoanPayment[],
): number {
  const principal = Number(loan.principal_amount || 0)
  const serviceCharge = Number(loan.service_charge_amount || 0)
  const totalPayments = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0,
  )
  return principal + serviceCharge - totalPayments
}

export function computeTotalPayments(payments: LoanPayment[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
}
