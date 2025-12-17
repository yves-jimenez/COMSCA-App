import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Member } from '../api/members'

type SortField = 'name' | 'record_id' | 'join_date' | 'shares' | 'social_fund'
type SortOrder = 'asc' | 'desc'

interface MembersScreenProps {
  members: Member[]
  selectedMemberId: string
  onSelectMember: (memberId: string) => void
  onCreateMember: (e: React.FormEvent) => void
  newMemberName: string
  onNameChange: (value: string) => void
  newMemberContact: string
  onContactChange: (value: string) => void
  loading: boolean
}

export function MembersScreen({
  members,
  selectedMemberId,
  onSelectMember,
  onCreateMember,
  newMemberName,
  onNameChange,
  newMemberContact,
  onContactChange,
  loading,
}: MembersScreenProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('record_id')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const sortedAndFilteredMembers = useMemo(() => {
    let filtered = members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.record_id.toString().includes(searchTerm) ||
        (m.contact_info?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
    )

    filtered.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortField) {
        case 'name':
          aVal = a.full_name
          bVal = b.full_name
          break
        case 'record_id':
          aVal = a.record_id
          bVal = b.record_id
          break
        case 'join_date':
          aVal = a.join_date
          bVal = b.join_date
          break
        case 'shares':
          aVal = Number(a.total_shares || 0)
          bVal = Number(b.total_shares || 0)
          break
        case 'social_fund':
          aVal = Number(a.total_social_fund_contributions || 0)
          bVal = Number(b.total_social_fund_contributions || 0)
          break
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return filtered
  }, [members, searchTerm, sortField, sortOrder])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Members List Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="lg:col-span-1 bg-white rounded-lg shadow-lg p-6 flex flex-col h-full"
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Members</h2>

        {/* Add Member Form */}
        <motion.form
          onSubmit={onCreateMember}
          className="space-y-3 mb-6 pb-6 border-b border-gray-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <input
            type="text"
            placeholder="Full name"
            value={newMemberName}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          />
          <input
            type="text"
            placeholder="Contact info"
            value={newMemberContact}
            onChange={(e) => onContactChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition"
          />
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-2 rounded-lg transition"
          >
            Add Member
          </motion.button>
        </motion.form>

        {/* Search and Sort Controls */}
        <motion.div
          className="space-y-3 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['record_id', 'name', 'join_date', 'shares', 'social_fund'] as SortField[]).map((field) => (
              <motion.button
                key={field}
                type="button"
                onClick={() => toggleSort(field)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition flex items-center gap-1 ${
                  sortField === field
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {field === 'record_id' && 'ID'}
                {field === 'name' && 'Name'}
                {field === 'join_date' && 'Date'}
                {field === 'shares' && 'Shares'}
                {field === 'social_fund' && 'Fund'}
                {sortField === field && (
                  <span style={{ transform: sortOrder === 'desc' ? 'scaleY(-1)' : 'scaleY(1)', display: 'inline-block' }}>↕</span>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          <AnimatePresence mode="popLayout">
            {sortedAndFilteredMembers.length > 0 ? (
              sortedAndFilteredMembers.map((member, index) => (
                <motion.button
                  key={member.id}
                  type="button"
                  onClick={() => onSelectMember(member.id)}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.02 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                    member.id === selectedMemberId
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">#{member.record_id} - {member.full_name}</div>
                      <div className="text-xs opacity-75">Joined {member.join_date}</div>
                    </div>
                    {member.id === selectedMemberId && (
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
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-gray-500 py-8"
              >
                No members found
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Member Details Placeholder */}
      <div className="lg:col-span-2">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="h-full"
        >
          {/* This will be filled by parent component */}
        </motion.div>
      </div>
    </div>
  )
}
