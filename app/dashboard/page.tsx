'use client'

import { useEffect, useState } from 'react'
import { 
  Users, 
  Settings, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  QrCode,
  Loader2,
  Shield,
  Home
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import type { Profile, AccessRule, UserRuleStatus } from '@/lib/types/database'

type ProfileWithRules = Profile & {
  rule_statuses: (UserRuleStatus & { rule: AccessRule })[]
}

export default function DashboardPage() {
  const [residents, setResidents] = useState<ProfileWithRules[]>([])
  const [rules, setRules] = useState<AccessRule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'residents' | 'settings'>('residents')
  const [selectedResident, setSelectedResident] = useState<ProfileWithRules | null>(null)
  
  // New Resident Form
  const [newResidentName, setNewResidentName] = useState('')
  const [newResidentEmail, setNewResidentEmail] = useState('')
  const [newResidentUnit, setNewResidentUnit] = useState('')
  const [newResidentPhone, setNewResidentPhone] = useState('')
  const [isAddingResident, setIsAddingResident] = useState(false)
  
  // New Rule Form
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleDescription, setNewRuleDescription] = useState('')
  const [isAddingRule, setIsAddingRule] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [residentsRes, rulesRes] = await Promise.all([
        fetch('/api/residents'),
        fetch('/api/rules'),
      ])
      
      const residentsData = await residentsRes.json()
      const rulesData = await rulesRes.json()
      
      setResidents(residentsData)
      setRules(rulesData.filter((r: AccessRule) => r.is_active))
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRule = async (userId: string, ruleId: string, currentStatus: boolean) => {
    try {
      await fetch('/api/toggle-rule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          rule_id: ruleId,
          status: !currentStatus,
        }),
      })
      
      // Reload data to reflect changes
      await loadData()
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  const addResident = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingResident(true)
    
    try {
      await fetch('/api/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newResidentName,
          email: newResidentEmail,
          unit: newResidentUnit,
          phone: newResidentPhone,
        }),
      })
      
      // Reset form
      setNewResidentName('')
      setNewResidentEmail('')
      setNewResidentUnit('')
      setNewResidentPhone('')
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error adding resident:', error)
    } finally {
      setIsAddingResident(false)
    }
  }

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingRule(true)
    
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_name: newRuleName,
          description: newRuleDescription,
        }),
      })
      
      // Reset form
      setNewRuleName('')
      setNewRuleDescription('')
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error adding rule:', error)
    } finally {
      setIsAddingRule(false)
    }
  }

  const getRuleStatus = (resident: ProfileWithRules, ruleId: string): boolean => {
    const ruleStatus = resident.rule_statuses?.find(
      (rs) => rs.rule_id === ruleId
    )
    return ruleStatus?.status ?? false
  }

  const downloadQRCode = (resident: ProfileWithRules) => {
    const canvas = document.getElementById(`qr-${resident.id}`) as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `${resident.name.replace(/\s+/g, '-')}-QR.png`
      link.href = url
      link.click()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-navy-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 via-teal-50 to-navy-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-teal-500 p-3 rounded-xl">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Secure Access Pass</h1>
                <p className="text-navy-200">Manager Command Center</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <a
                href="/scanner"
                className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
              >
                <QrCode className="w-5 h-5" />
                Open Scanner
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-md border-b border-navy-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('residents')}
              className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'residents'
                  ? 'border-teal-500 text-navy-900'
                  : 'border-transparent text-navy-500 hover:text-navy-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Residents ({residents.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-teal-500 text-navy-900'
                  : 'border-transparent text-navy-500 hover:text-navy-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Access Rules ({rules.length})
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'residents' && (
          <div className="space-y-6">
            {/* Add Resident Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" />
                Add New Resident
              </h2>
              <form onSubmit={addResident} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newResidentName}
                  onChange={(e) => setNewResidentName(e.target.value)}
                  required
                  className="px-4 py-3 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newResidentEmail}
                  onChange={(e) => setNewResidentEmail(e.target.value)}
                  required
                  className="px-4 py-3 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Unit #"
                  value={newResidentUnit}
                  onChange={(e) => setNewResidentUnit(e.target.value)}
                  required
                  className="px-4 py-3 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={newResidentPhone}
                  onChange={(e) => setNewResidentPhone(e.target.value)}
                  className="px-4 py-3 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={isAddingResident}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {isAddingResident ? 'Adding...' : 'Add Resident'}
                </button>
              </form>
            </div>

            {/* Residents Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-navy-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-navy-800 text-white">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold">Resident</th>
                      <th className="px-6 py-4 text-left text-sm font-bold">Unit</th>
                      <th className="px-6 py-4 text-left text-sm font-bold">Location</th>
                      {rules.map((rule) => (
                        <th key={rule.id} className="px-6 py-4 text-center text-sm font-bold">
                          {rule.rule_name}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-center text-sm font-bold">QR Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-200">
                    {residents.map((resident, idx) => (
                      <tr 
                        key={resident.id}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-navy-50'}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-navy-900">{resident.name}</div>
                            <div className="text-sm text-navy-600">{resident.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-navy-700">
                            <Home className="w-4 h-4" />
                            <span className="font-medium">{resident.unit}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              resident.current_location === 'INSIDE'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-navy-100 text-navy-800'
                            }`}
                          >
                            {resident.current_location}
                          </span>
                        </td>
                        {rules.map((rule) => {
                          const status = getRuleStatus(resident, rule.id)
                          return (
                            <td key={rule.id} className="px-6 py-4 text-center">
                              <button
                                onClick={() => toggleRule(resident.id, rule.id, status)}
                                className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:scale-110 transition-transform"
                              >
                                {status ? (
                                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                                ) : (
                                  <XCircle className="w-7 h-7 text-red-600" />
                                )}
                              </button>
                            </td>
                          )
                        })}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setSelectedResident(resident)}
                            className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all"
                          >
                            View QR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Add Rule Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" />
                Add New Access Rule
              </h2>
              <form onSubmit={addRule} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Rule Name (e.g., 'Pet Deposit')"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  required
                  className="px-4 py-3 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newRuleDescription}
                  onChange={(e) => setNewRuleDescription(e.target.value)}
                  className="px-4 py-3 border border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={isAddingRule}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {isAddingRule ? 'Adding...' : 'Add Rule'}
                </button>
              </form>
            </div>

            {/* Rules List */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-4">Active Access Rules</h2>
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 bg-navy-50 rounded-lg border border-navy-200"
                  >
                    <div>
                      <div className="font-semibold text-navy-900">{rule.rule_name}</div>
                      {rule.description && (
                        <div className="text-sm text-navy-600 mt-1">{rule.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                        Active
                      </span>
                    </div>
                  </div>
                ))}
                {rules.length === 0 && (
                  <div className="text-center py-8 text-navy-500">
                    No access rules configured yet. Add your first rule above.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {selectedResident && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedResident(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-navy-900 mb-2">
              {selectedResident.name}
            </h3>
            <p className="text-navy-600 mb-6">Unit {selectedResident.unit}</p>
            
            <div className="bg-white p-6 rounded-xl border-4 border-navy-800 mb-6">
              <QRCodeCanvas
                id={`qr-${selectedResident.id}`}
                value={selectedResident.qr_code}
                size={300}
                level="H"
                className="w-full h-auto"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => downloadQRCode(selectedResident)}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Download QR Code
              </button>
              <button
                onClick={() => setSelectedResident(null)}
                className="flex-1 bg-navy-200 hover:bg-navy-300 text-navy-900 px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
