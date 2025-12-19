import { useState } from 'react'
import { type YearEndDistribution } from '../api/yearEnd'

interface YearEndModalProps {
  distribution: YearEndDistribution | null
  isOpen: boolean
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function YearEndModal({
  distribution,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: YearEndModalProps) {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  if (!isOpen || !distribution) return null

  const { members, summary } = distribution

  const handleConfirmClick = () => {
    setShowPasswordPrompt(true)
    setPassword('')
    setPasswordError('')
  }

  const handlePasswordSubmit = () => {
    if (!password.trim()) {
      setPasswordError('Password is required')
      return
    }

    const correctPassword = 'COMSCA2026'
    if (password !== correctPassword) {
      setPasswordError('Incorrect password')
      setPassword('')
      return
    }

    setShowPasswordPrompt(false)
    setPassword('')
    setPasswordError('')
    onConfirm()
  }

  const handlePasswordCancel = () => {
    setShowPasswordPrompt(false)
    setPassword('')
    setPasswordError('')
  }

  if (showPasswordPrompt) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Confirm Year-End Clear</h2>
            <p className="text-gray-600 mb-6">
              Enter the password to confirm clearing all data for year-end operations. Make sure to download the PDF. This action cannot be undone.
            </p>
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit()
                  }
                }}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-600 text-sm mt-2">{passwordError}</p>
              )}
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handlePasswordCancel}
                className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordSubmit}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold rounded-lg transition"
              >
                {isLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Year-End Distribution Preview</h2>

          {/* Summary Section */}
          <section className="mb-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Total Members</p>
                <p className="text-2xl font-bold text-blue-600">{summary.numMembers}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Total Shares</p>
                <p className="text-2xl font-bold text-green-600">
                  ₱{summary.totalShares.toFixed(2)}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Service Charge</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₱{summary.totalServiceChargeEarnings.toFixed(2)}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Total Penalties</p>
                <p className="text-2xl font-bold text-red-600">
                  ₱{summary.totalPenalties.toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Social Fund</p>
                <p className="text-2xl font-bold text-purple-600">
                  ₱{summary.totalSocialFund.toFixed(2)}
                </p>
              </div>
            </div>
          </section>

          {/* Per-Member Distribution Table */}
          <section className="mb-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Per-Member Distribution</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Member</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">
                      Shares (₱)
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">
                      Service Charge
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">
                      Social Fund
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Cash to be Dispersed</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{m.full_name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        ₱{m.totalShares.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-600 font-semibold">
                        ₱{m.serviceChargeEarnings.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-purple-600 font-semibold">
                        ₱{m.socialFundShare.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-bold">
                        ₱{m.totalDistribution.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Warning */}
          <section className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-yellow-800">
              ⚠️ <strong>Warning:</strong> This will clear all contributions, loans, and loan
              payments. Members will be retained. This action cannot be undone.
            </p>
          </section>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-6 py-3 bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={isLoading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold rounded-lg transition"
            >
              {isLoading ? 'Processing...' : 'Confirm & Clear'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
