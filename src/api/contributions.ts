import { supabase } from '../lib/supabaseClient'

export type ContributionType = 'SHARE' | 'SOCIAL_FUND'

export type Contribution = {
  id: number
  member_id: string
  type: ContributionType
  amount: string
  contribution_date: string
  remarks: string | null
}

export type CreateContributionInput = {
  member_id: string
  type: ContributionType
  amount: number
  contribution_date?: string
  remarks?: string
}

export async function listMemberContributions(memberId: string): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from('contributions')
    .select('id, member_id, type, amount, contribution_date, remarks')
    .eq('member_id', memberId)
    .order('contribution_date', { ascending: true })

  if (error) throw error
  return data as Contribution[]
}

export async function createContribution(input: CreateContributionInput): Promise<Contribution> {
  const { data, error } = await supabase
    .from('contributions')
    .insert({
      member_id: input.member_id,
      type: input.type,
      amount: input.amount,
      contribution_date: input.contribution_date ?? new Date().toISOString().slice(0, 10),
      remarks: input.remarks ?? null,
    })
    .select('id, member_id, type, amount, contribution_date, remarks')
    .single()

  if (error) throw error
  return data as Contribution
}
