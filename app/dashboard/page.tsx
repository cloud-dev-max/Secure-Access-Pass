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
  Home,
  TrendingUp,
  Activity,
  Clock,
  LogIn,
  LogOut
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import type { Profile, AccessRule, UserRuleStatus } from '@/lib/types/database'
import CsvUploader from '@/components/CsvUploader'

type ProfileWithRules = Profile & {
  rule_statuses: (UserRuleStatus & { rule: AccessRule })[]
}

interface Stats {
  totalResidents: number
  currentOccupancy: number
  activeRules: number
  recentActivity: any[]
}

export default function DashboardPage() {
  const [residents, setResidents] = useState<ProfileWithRules[]>([])
  const [rules, setRules] = useState<AccessRule[]>([])
  const [stats, setStats] = useState<Stats>({
    totalResidents: 0,
    currentOccupancy: 0,
    activeRules: 0,
    recentActivity: [],
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'residents' | 'settings'>('overview')
  const [selectedResident, setSelectedResident] = useState<ProfileWithRules | null>(null)
  
  // New Resident Form
  const [newResidentName, setNewResidentName] = useState('')
  const [newResidentEmail, setNewResidentEmail] = useState('')
  const [newResidentUnit, setNewResidentUnit] = useState('')
  const [newResidentPhone, setNewResidentPhone] = useState('')
  const [isAddingResident, setIsAddingResident] = useState(false)
  
  // New Rule Form
  const [newRuleName, setNewRuleName] = useState('')
  const [isAddingRule, setIsAddingRule] = useState(false)

  // Maintenance mode state
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [togglingMaintenance, setTogglingMaintenance] = useState(false)

  useEffect(() => {
    loadData()
    loadMaintenanceStatus()
  }, [])

  const loadMaintenanceStatus = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        setIsMaintenanceMode(data.is_maintenance_mode || false)
      }
    } catch (error) {
      console.error('Error loading maintenance status:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [residentsRes, rulesRes, statsRes] = await Promise.all([
        fetch('/api/residents'),
        fetch('/api/rules'),
        fetch('/api/stats'),
      ])
      
      // Check if responses are OK
      if (!residentsRes.ok || !rulesRes.ok || !statsRes.ok) {
        console.error('API Error:', {
          residents: residentsRes.status,
          rules: rulesRes.status,
          stats: statsRes.status,
        })
        throw new Error('Failed to fetch data from API')
      }
      
      const residentsData = await residentsRes.json()
      const rulesData = await rulesRes.json()
      const statsData = await statsRes.json()
      
      // Ensure we always have arrays
      setResidents(Array.isArray(residentsData) ? residentsData : [])
      setRules(Array.isArray(rulesData) ? rulesData.filter((r: AccessRule) => r.is_active) : [])
      setStats(statsData)
    } catch (error) {
      console.error('Error loading data:', error)
      setResidents([])
      setRules([])
      alert('Failed to load data. Please check your Supabase connection and ensure the database schema is set up correctly.')
    } finally {
      setLoading(false)
    }
  }

  const toggleRule = async (userId: string, ruleId: string, currentStatus: boolean) => {
    // OPTIMISTIC UI UPDATE - Update immediately
    const newStatus = !currentStatus
    setResidents(prevResidents => 
      prevResidents.map(r => {
        if (r.id === userId) {
          return {
            ...r,
            rule_statuses: r.rule_statuses.map(rs => 
              rs.rule_id === ruleId ? { ...rs, status: newStatus } : rs
            )
          }
        }
        return r
      })
    )

    // Save to backend in background
    try {
      const response = await fetch('/api/toggle-rule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          rule_id: ruleId,
          status: newStatus,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle rule')
      }
    } catch (error) {
      console.error('Error toggling rule:', error)
      // Revert on error
      setResidents(prevResidents => 
        prevResidents.map(r => {
          if (r.id === userId) {
            return {
              ...r,
              rule_statuses: r.rule_statuses.map(rs => 
                rs.rule_id === ruleId ? { ...rs, status: currentStatus } : rs
              )
            }
          }
          return r
        })
      )
      alert('Failed to update rule status')
    }
  }

  const toggleMaintenanceMode = async () => {
    // Optimistic update
    const newMode = !isMaintenanceMode
    setIsMaintenanceMode(newMode)
    setTogglingMaintenance(true)

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_maintenance_mode: newMode,
          maintenance_reason: newMode ? 'Pool temporarily closed' : null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle maintenance mode')
      }
      
      // Reload stats to reflect changes
      await loadMaintenanceStatus()
    } catch (error) {
      console.error('Error toggling maintenance mode:', error)
      // Revert on error
      setIsMaintenanceMode(!newMode)
      alert('Failed to toggle maintenance mode')
    } finally {
      setTogglingMaintenance(false)
    }
  }

  const addResident = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingResident(true)
    
    try {
      const response = await fetch('/api/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newResidentName,
          email: newResidentEmail,
          unit: newResidentUnit,
          phone: newResidentPhone,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to add resident:', errorData)
        alert(`Failed to add resident: ${errorData.error || 'Unknown error'}`)
        return
      }
      
      // Reset form
      setNewResidentName('')
      setNewResidentEmail('')
      setNewResidentUnit('')
      setNewResidentPhone('')
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error adding resident:', error)
      alert('Network error. Please check your connection and try again.')
    } finally {
      setIsAddingResident(false)
    }
  }

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingRule(true)
    
    try {
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_name: newRuleName,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to add rule:', errorData)
        alert(`Failed to add rule: ${errorData.error || 'Unknown error'}`)
        return
      }
      
      // Reset form
      setNewRuleName('')
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error adding rule:', error)
      alert('Network error. Please check your connection and try again.')
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
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-navy-600 animate-spin mx-auto mb-4" />
          <p className="text-navy-600 font-semibold">Loading dashboard...</p>
        </div>
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
                href="/"
                className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all"
              >
                <Home className="w-5 h-5" />
                Home
              </a>
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
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-teal-500 text-navy-900'
                  : 'border-transparent text-navy-500 hover:text-navy-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Overview
              </div>
            </button>
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
                Residents ({stats.totalResidents})
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
                Access Rules ({stats.activeRules})
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Residents */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">{stats.totalResidents}</span>
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-1">Total Residents</h3>
                <p className="text-sm text-navy-600">Active residents in the system</p>
              </div>

              {/* Current Occupancy */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-teal-100 p-3 rounded-lg">
                    <Activity className="w-6 h-6 text-teal-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">{stats.currentOccupancy}</span>
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-1">Current Occupancy</h3>
                <p className="text-sm text-navy-600">Residents currently inside the pool</p>
              </div>

              {/* Active Rules */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-3xl font-bold text-navy-900">{stats.activeRules}</span>
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-1">Active Rules</h3>
                <p className="text-sm text-navy-600">Access control rules in effect</p>
              </div>
            </div>

            {/* Maintenance Mode Quick Toggle */}
            <div className={`rounded-xl shadow-lg p-6 border-2 transition-all ${
              isMaintenanceMode 
                ? 'bg-red-50 border-red-300' 
                : 'bg-green-50 border-green-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${
                    isMaintenanceMode ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    <Shield className={`w-6 h-6 ${
                      isMaintenanceMode ? 'text-red-600' : 'text-green-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-navy-900 mb-1">
                      Pool Status: {isMaintenanceMode ? 'CLOSED' : 'OPEN'}
                    </h3>
                    <p className="text-sm text-navy-600">
                      {isMaintenanceMode 
                        ? 'Maintenance mode active - All access denied' 
                        : 'Operating normally - Access granted per rules'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={toggleMaintenanceMode}
                  disabled={togglingMaintenance}
                  className={`relative inline-flex h-12 w-24 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                    isMaintenanceMode 
                      ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500' 
                      : 'bg-green-500 hover:bg-green-600 focus:ring-green-500'
                  }`}
                  role="switch"
                  aria-checked={isMaintenanceMode}
                  title="Toggle Maintenance Mode"
                >
                  <span
                    className={`inline-block h-10 w-10 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                      isMaintenanceMode ? 'translate-x-13' : 'translate-x-1'
                    }`}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                    {isMaintenanceMode ? 'OFF' : 'ON'}
                  </span>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-6 h-6 text-navy-600" />
                <h2 className="text-2xl font-bold text-navy-900">Recent Activity</h2>
              </div>
              
              {stats.recentActivity.length === 0 ? (
                <div className="text-center py-8 text-navy-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-semibold">No activity yet</p>
                  <p className="text-sm">Access logs will appear here once scanning begins</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((log, idx) => (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        log.result === 'GRANTED'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {log.scan_type === 'ENTRY' ? (
                          <LogIn className={`w-5 h-5 ${
                            log.result === 'GRANTED' ? 'text-green-600' : 'text-red-600'
                          }`} />
                        ) : (
                          <LogOut className={`w-5 h-5 ${
                            log.result === 'GRANTED' ? 'text-green-600' : 'text-red-600'
                          }`} />
                        )}
                        <div>
                          <p className="font-semibold text-navy-900">
                            {log.user?.name || 'Unknown'} - Unit {log.user?.unit || 'N/A'}
                          </p>
                          <p className="text-sm text-navy-600">
                            {log.scan_type} • {log.result}
                            {log.denial_reason && ` • ${log.denial_reason}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-navy-500">
                        {new Date(log.scanned_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-teal-500 to-navy-600 rounded-xl p-6 text-white">
              <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('residents')}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-4 text-left transition-all"
                >
                  <Users className="w-6 h-6 mb-2" />
                  <h4 className="font-semibold">Manage Residents</h4>
                  <p className="text-sm text-white/80">Add, view, or edit resident information</p>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-4 text-left transition-all"
                >
                  <Settings className="w-6 h-6 mb-2" />
                  <h4 className="font-semibold">Configure Rules</h4>
                  <p className="text-sm text-white/80">Create and manage access rules</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RESIDENTS TAB */}
        {activeTab === 'residents' && (
          <div className="space-y-6">
            {/* Add Resident Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" />
                Add New Resident
              </h2>
              <form onSubmit={addResident} className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newResidentName}
                  onChange={(e) => setNewResidentName(e.target.value)}
                  required
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newResidentEmail}
                  onChange={(e) => setNewResidentEmail(e.target.value)}
                  required
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
                />
                <input
                  type="text"
                  placeholder="Unit #"
                  value={newResidentUnit}
                  onChange={(e) => setNewResidentUnit(e.target.value)}
                  required
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={newResidentPhone}
                  onChange={(e) => setNewResidentPhone(e.target.value)}
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={isAddingResident}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {isAddingResident ? 'Adding...' : 'Add Resident'}
                </button>
                <CsvUploader onUploadComplete={loadData} />
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
                    {residents.length === 0 ? (
                      <tr>
                        <td colSpan={rules.length + 4} className="px-6 py-12 text-center">
                          <div className="text-navy-500">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-lg font-semibold mb-1">No residents yet</p>
                            <p className="text-sm">Add your first resident using the form above.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      residents.map((resident, idx) => (
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
                                {/* Toggle Switch Component - Bug Fix #1 & #3 */}
                                <button
                                  onClick={() => toggleRule(resident.id, rule.id, status)}
                                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                                    status 
                                      ? 'bg-green-500 hover:bg-green-600' 
                                      : 'bg-gray-300 hover:bg-gray-400'
                                  }`}
                                  role="switch"
                                  aria-checked={status}
                                  title={status ? 'Rule Met (Click to mark as Failed)' : 'Rule Not Met (Click to mark as Passed)'}
                                >
                                  {/* Toggle Circle */}
                                  <span
                                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                      status ? 'translate-x-9' : 'translate-x-1'
                                    }`}
                                  >
                                    {/* Icon inside circle */}
                                    {status ? (
                                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    ) : (
                                      <XCircle className="w-6 h-6 text-gray-500" />
                                    )}
                                  </span>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Facility Settings Card */}
            <div className="bg-gradient-to-r from-teal-500 to-navy-600 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-bold mb-2">Facility Settings</h2>
              <p className="text-white/90 mb-4">
                Configure operating hours, capacity limits, guest pass pricing, and maintenance mode
              </p>
              <a
                href="/dashboard/settings"
                className="inline-block bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Manage Facility Settings →
              </a>
            </div>

            {/* Add Rule Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-navy-200">
              <h2 className="text-xl font-bold text-navy-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" />
                Add New Access Rule
              </h2>
              <form onSubmit={addRule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Rule Name (e.g., 'Rent Paid', 'Pet Deposit')"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  required
                  className="px-4 py-3 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 placeholder-gray-500 bg-white"
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
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 bg-navy-50 rounded-lg border border-navy-200 hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-teal-100 p-2 rounded-lg">
                        <Shield className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-navy-900">{rule.rule_name}</div>
                        <div className="text-sm text-navy-600">
                          Created {new Date(rule.created_at).toLocaleDateString()}
                        </div>
                      </div>
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
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-semibold mb-1">No access rules configured</p>
                    <p className="text-sm">Add your first rule above to start managing access.</p>
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
