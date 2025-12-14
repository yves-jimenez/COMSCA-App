import { type YearEndDistribution } from '../api/yearEnd'

interface YearEndReportProps {
  distribution: YearEndDistribution | null
  isOpen: boolean
  onClose: () => void
}

export function YearEndReport({
  distribution,
  isOpen,
  onClose,
}: YearEndReportProps) {
  if (!isOpen || !distribution) return null

  const { members, summary } = distribution
  const reportDate = new Date().toLocaleString()

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header with Close & Print Buttons */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center print:hidden">
          <h2 className="text-3xl font-bold text-gray-800">Year-End Report</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Print / Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-8 print:p-4">
          {/* Title & Date */}
          <div className="text-center mb-8 pb-6 border-b-2 border-gray-300">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">COMSCA Year-End Report</h1>
            <p className="text-gray-600 text-lg">Generated: {reportDate}</p>
          </div>

          {/* Financial Summary */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">
              Financial Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-gray-600 text-sm font-medium">Total Members</p>
                <p className="text-2xl font-bold text-blue-600">{summary.numMembers}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-gray-600 text-sm font-medium">Total Shares</p>
                <p className="text-2xl font-bold text-green-600">
                  ₱{summary.totalShares.toFixed(2)}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-gray-600 text-sm font-medium">Service Charge Earnings</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₱{summary.totalServiceChargeEarnings.toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-gray-600 text-sm font-medium">Social Fund</p>
                <p className="text-2xl font-bold text-purple-600">
                  ₱{summary.totalSocialFund.toFixed(2)}
                </p>
              </div>
            </div>
          </section>

          {/* Total Distribution */}
          <section className="mb-8 bg-gray-50 p-6 rounded-lg border-2 border-gray-300">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Total Distribution</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Shares Returned</p>
                <p className="text-2xl font-bold text-gray-800">
                  ₱{summary.totalShares.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Service Charge Distributed</p>
                <p className="text-2xl font-bold text-gray-800">
                  ₱{summary.totalServiceChargeEarnings.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Social Fund Distributed</p>
                <p className="text-2xl font-bold text-gray-800">
                  ₱{summary.totalSocialFund.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t-2 border-gray-300">
              <p className="text-gray-600 text-sm font-medium">Grand Total</p>
              <p className="text-3xl font-bold text-green-600">
                ₱
                {(
                  summary.totalShares +
                  summary.totalServiceChargeEarnings +
                  summary.totalSocialFund
                ).toFixed(2)}
              </p>
            </div>
          </section>

          {/* Per-Member Distribution */}
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500">
              Per-Member Distribution
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">
                      Member Name
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-700">
                      Shares (₱)
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-700">
                      Service Charge (₱)
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-700">
                      Social Fund (₱)
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-right font-semibold text-gray-700">
                      Total (₱)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2 font-medium text-gray-800">
                        {m.full_name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-gray-700">
                        {m.totalShares.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-gray-700">
                        {m.serviceChargeEarnings.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right text-gray-700">
                        {m.socialFundShare.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-semibold text-green-600">
                        {m.totalDistribution.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-gray-300 text-center text-gray-600 text-sm">
            <p>This report was automatically generated by COMSCA Admin System</p>
            <p className="mt-2">For official records and audit purposes</p>
          </div>
        </div>
      </div>
    </div>
  )
}
