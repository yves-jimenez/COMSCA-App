import { supabase } from '../lib/supabaseClient'

export type Member = {
  id: string
  full_name: string
  contact_info: string | null
  join_date: string
  total_shares: string
  total_social_fund_contributions: string
  total_penalties: string
}

export type CreateMemberInput = {
  full_name: string
  contact_info?: string
  join_date?: string
}

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('id, full_name, contact_info, join_date, total_shares, total_social_fund_contributions, total_penalties')
    .order('join_date', { ascending: true })

  if (error) throw error
  return data as Member[]
}

export async function createMember(input: CreateMemberInput): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .insert({
      full_name: input.full_name,
      contact_info: input.contact_info ?? null,
      join_date: input.join_date ?? new Date().toISOString().slice(0, 10),
    })
    .select('id, full_name, contact_info, join_date, total_shares, total_social_fund_contributions, total_penalties')
    .single()

  if (error) throw error
  return data as Member
}
