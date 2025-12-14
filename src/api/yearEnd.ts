import { supabase } from '../lib/supabaseClient'
import { type Member } from './members'
import { type Loan } from './loans'

export type YearEndDistribution = {
  members: Array<{
    id: string
    full_name: string
    totalShares: number
    serviceChargeEarnings: number
    socialFundShare: number
    totalDistribution: number
  }>
  summary: {
    totalShares: number
    totalServiceChargeEarnings: number
    totalSocialFund: number
    numMembers: number
  }
}

export async function computeYearEndDistribution(
  members: Member[],
  loans: Loan[],
): Promise<YearEndDistribution> {
  // Compute totals
  const totalShares = members.reduce(
    (sum, m) => sum + Number(m.total_shares || 0),
    0,
  )
  const totalServiceChargeEarnings = loans.reduce(
    (sum, l) => sum + Number(l.service_charge_amount || 0),
    0,
  )
  const totalPenalties = members.reduce(
    (sum, m) => sum + Number(m.total_penalties || 0),
    0,
  )
  // Add penalties to service charge earnings for distribution
  const totalEarningsWithPenalties = totalServiceChargeEarnings + totalPenalties
  const totalSocialFund = members.reduce(
    (sum, m) => sum + Number(m.total_social_fund_contributions || 0),
    0,
  )
  const numMembers = members.length

  // Compute per-member distribution
  const memberDistributions = members.map((m) => {
    const memberShares = Number(m.total_shares || 0)
    const serviceChargeEarnings =
      totalShares > 0
        ? (memberShares / totalShares) * totalEarningsWithPenalties
        : 0
    const socialFundShare = numMembers > 0 ? totalSocialFund / numMembers : 0

    return {
      id: m.id,
      full_name: m.full_name,
      totalShares: memberShares,
      serviceChargeEarnings: Math.round(serviceChargeEarnings * 100) / 100,
      socialFundShare: Math.round(socialFundShare * 100) / 100,
      totalDistribution:
        Math.round(
          (memberShares + serviceChargeEarnings + socialFundShare) * 100,
        ) / 100,
    }
  })

  return {
    members: memberDistributions,
    summary: {
      totalShares,
      totalServiceChargeEarnings: totalEarningsWithPenalties,
      totalSocialFund,
      numMembers,
    },
  }
}

export async function clearYearData(): Promise<void> {
  // Delete in order of FK dependencies: loan_payments -> loans -> contributions
  const { error: paymentsError } = await supabase
    .from('loan_payments')
    .delete()
    .neq('id', -1) // Delete all rows

  if (paymentsError) throw paymentsError

  const { error: loansError } = await supabase
    .from('loans')
    .delete()
    .neq('id', -1) // Delete all rows

  if (loansError) throw loansError

  const { error: contributionsError } = await supabase
    .from('contributions')
    .delete()
    .neq('id', -1) // Delete all rows

  if (contributionsError) throw contributionsError

  // Triggers will automatically reset members.total_shares and total_social_fund_contributions to 0
}
