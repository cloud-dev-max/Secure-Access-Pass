'use client'

import { useState, useEffect, useContext } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PropertyContext } from '@/app/context/PropertyContext'
import { Shield, MessageSquare, LogIn, LogOut, ArrowLeft, ChevronLeft, ChevronRight, Loader2, Calendar, X, Download, TrendingUp, Users, Settings as SettingsIcon, DollarSign, Activity } from 'lucide-react'

interface Log {
  id: string
  qr_code: string
  scan_type: string
  result: string
  denial_reason: string | null
  guest_count: number
  scanned_at: string
  profile?: {
    name: string
    unit: string
  } | null
}

interface LogsResponse {
  logs: Log[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function LogsPage() {
  const router = useRouter()
  const { propertyId } = useContext(PropertyContext) // V10.8.12: Multi-tenancy
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  // V9.0 Feature #2: Date range picker
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    if (propertyId) {
      loadLogs(page)
    }
  }, [page, startDate, endDate, propertyId]) // V10.8.12: Reload when property changes

  const loadLogs = async (pageNum: number) => {
    if (!propertyId) return
    
    try {
      setLoading(true)
      // V9.0 Feature #2: Add date range parameters if set
      // V10.8.12: Add property_id for multi-tenancy isolation
      let url = `/api/logs?page=${pageNum}&limit=50&property_id=${propertyId}`
      if (startDate) {
        url += `&startDate=${startDate}`
      }
      if (endDate) {
        url += `&endDate=${endDate}`
      }
      console.log('[V10.8.12] Loading logs for property:', propertyId)
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch logs')
      
      const data: LogsResponse = await response.json()
      setLogs(data.logs)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error loading logs:', error)
      alert('Failed to load activity logs')
    } finally {
      setLoading(false)
    }
  }

  // V9.0 Feature #2: Clear date range filter and reload
  const clearDateFilter = () => {
    setStartDate('')
    setEndDate('')
    setPage(1) // Reset to first page
  }

  // V9.0 Feature #2 + V9.1 Fix #2: Export activity log to CSV with date range filtering and correct field mapping
  // V10.8.12: Add property_id for multi-tenancy isolation
  const exportActivityCSV = async () => {
    if (!propertyId) {
      alert('No property selected')
      return
    }
    
    try {
      // Build URL with date range if set
      let url = `/api/activity-logs?limit=5000&property_id=${propertyId}`;
      if (startDate) {
        url += `&startDate=${startDate}`
      }
      if (endDate) {
        url += `&endDate=${endDate}`
      }
      
      console.log('[V10.8.12] Exporting logs for property:', propertyId)
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch activity logs');
      
      const data = await response.json();
      const logs = data.logs || [];
      
      const headers = ['Timestamp', 'Name', 'Type', 'Action', 'Result', 'Unit', 'Guests', 'Total People'];
      const rows = logs.map((log: any) => {
        // V9.1 Fix #2: Correct field mapping - use scanned_at and nested user object
        const timestamp = log.scanned_at ? new Date(log.scanned_at).toLocaleString() : 'N/A'
        
        // V9.1 Fix #2 + V9.3 Fix #1: Detect visitor passes and system events
        const isVisitorPass = log.qr_code?.startsWith('GUEST-') || log.qr_code?.startsWith('VISITOR-')
        const isStatusChange = log.qr_code === 'STATUS_CHANGE' || (log.denial_reason && log.denial_reason.includes('Status changed from'))
        const isSystemBroadcast = log.qr_code === 'SYSTEM_BROADCAST' || (log.denial_reason && log.denial_reason.includes('BROADCAST'))
        const isSystemEvent = isStatusChange || isSystemBroadcast
        
        // V9.3 Fix #1: System events should show 'System' as name, not 'Unknown'
        let name = log.user?.name || log.profile?.name || 'Unknown'
        if (isSystemEvent) {
          name = 'System'
        }
        
        const unit = log.user?.unit || log.profile?.unit || 'N/A'
        
        let type = 'Resident'
        if (isSystemEvent) {
          type = 'System Event'
        } else if (isVisitorPass) {
          type = 'Visitor Pass'
        }
        
        // V9.4 Fix #2: Mirror UI logic - show event description as Action
        // Copy EXACT logic from dashboard (lines 1546-1559)
        let action = log.scan_type || 'SCAN'
        let result = log.result || 'N/A'
        
        if (isStatusChange) {
          // Action = "Pool Status Change", Result = the actual status message
          action = 'Pool Status Change'
          result = log.denial_reason || 'Status Changed'
        } else if (isSystemBroadcast) {
          // V9.5 Fix #3: Show actual broadcast message, not recipient count
          action = 'System Broadcast'
          // denial_reason contains the broadcast message
          result = log.denial_reason || `Broadcast to ${log.guest_count || 0} recipients`
        }
        
        // V9.3 Fix #1 + V9.4 Fix #2: System events - use 0 for Guests, N/A for Total People
        let guests: any = log.guest_count || 0
        let totalPeople: any = 1 + (log.guest_count || 0)
        
        if (isSystemEvent) {
          guests = 0
          totalPeople = 'N/A'
        }
        
        return [timestamp, name, type, action, result, unit, guests, totalPeople]
      });
      
      const csvContent = [
        'Access Activity Log',
        `Generated: ${new Date().toLocaleString()}`,
        `Total Records: ${logs.length}`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // V9.5 Fix #3: Add UTF-8 BOM for proper emoji rendering in Excel
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      // V9.0 Feature #2: Dynamic filename with date range
      let filename = 'activity-audit';
      if (startDate && endDate) {
        const start = startDate.split('-').slice(1).join('-'); // MM-DD
        const end = endDate.split('-').slice(1).join('-'); // MM-DD
        const year = new Date().getFullYear();
        filename = `activity-audit-${start}-to-${end}-${year}`;
      } else if (startDate || endDate) {
        filename = `activity-audit-${startDate || endDate}`;
      } else {
        filename = `activity-log-${new Date().toISOString().split('T')[0]}`;
      }
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error exporting activity log:', error);
      alert('Failed to export activity log');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date)
  }

  const getLogIcon = (log: Log) => {
    const isStatusChange = log.qr_code === 'STATUS_CHANGE' || (log.denial_reason && log.denial_reason.includes('Status changed from'))
    const isSystemBroadcast = log.qr_code === 'SYSTEM_BROADCAST' || (log.denial_reason && log.denial_reason.includes('BROADCAST'))
    
    if (isStatusChange) {
      return <Shield className="w-5 h-5 text-indigo-600" />
    }
    if (isSystemBroadcast) {
      return <MessageSquare className="w-5 h-5 text-orange-600" />
    }
    if (log.scan_type === 'ENTRY') {
      return <LogIn className="w-5 h-5 text-green-600" />
    }
    return <LogOut className="w-5 h-5 text-blue-600" />
  }

  const getLogStyles = (log: Log) => {
    const isStatusChange = log.qr_code === 'STATUS_CHANGE' || (log.denial_reason && log.denial_reason.includes('Status changed from'))
    const isSystemBroadcast = log.qr_code === 'SYSTEM_BROADCAST' || (log.denial_reason && log.denial_reason.includes('BROADCAST'))
    
    if (isStatusChange) {
      return 'bg-indigo-50 border-indigo-200'
    }
    if (isSystemBroadcast) {
      return 'bg-orange-50 border-orange-200'
    }
    if (log.result === 'DENIED') {
      return 'bg-red-50 border-red-200'
    }
    if (log.scan_type === 'ENTRY') {
      return 'bg-green-50 border-green-200'
    }
    return 'bg-blue-50 border-blue-200'
  }

  const getLogLabel = (log: Log) => {
    // V8.4 Fix #2: Detect visitor pass scans
    const isVisitorPass = log.qr_code?.startsWith('GUEST-') || log.qr_code?.startsWith('VISITOR-')
    const isStatusChange = log.qr_code === 'STATUS_CHANGE' || (log.denial_reason && log.denial_reason.includes('Status changed from'))
    const isSystemBroadcast = log.qr_code === 'SYSTEM_BROADCAST' || (log.denial_reason && log.denial_reason.includes('BROADCAST'))
    
    if (isStatusChange) {
      return <span className="font-semibold text-indigo-900">Pool Status Change</span>
    }
    if (isSystemBroadcast) {
      return <span className="font-semibold text-orange-900">System Broadcast</span>
    }
    if (isVisitorPass && log.profile) {
      return (
        <>
          <span className="font-semibold text-navy-900">Visitor Pass (Guest of {log.profile.name})</span>
          <span className="text-navy-600"> • Unit {log.profile.unit}</span>
        </>
      )
    }
    if (log.profile) {
      return (
        <>
          <span className="font-semibold text-navy-900">{log.profile.name}</span>
          <span className="text-navy-600"> • Unit {log.profile.unit}</span>
        </>
      )
    }
    return <span className="text-navy-600">Unknown User</span>
  }

  const getLogDetails = (log: Log) => {
    const isStatusChange = log.qr_code === 'STATUS_CHANGE' || (log.denial_reason && log.denial_reason.includes('Status changed from'))
    const isSystemBroadcast = log.qr_code === 'SYSTEM_BROADCAST' || (log.denial_reason && log.denial_reason.includes('BROADCAST'))
    
    if (isStatusChange || isSystemBroadcast) {
      return <div className="text-sm text-navy-700 mt-1">{log.denial_reason}</div>
    }

    return (
      <div className="text-sm text-navy-600 mt-1">
        {log.guest_count > 0 && <span className="mr-2">+{log.guest_count} guests</span>}
        <span className="capitalize">{log.scan_type.toLowerCase()}</span>
        <span className="mx-2">•</span>
        <span>{log.result}</span>
        {log.denial_reason && (
          <>
            <span className="mx-2">•</span>
            <span className="text-red-600">{log.denial_reason}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 via-white to-blue-50">
      {/* V10.8.16: Simplified header - tabs only, no back button or title */}
      {/* V10.8.17: Match dashboard navigation layout exactly for seamless transition */}
      {/* V10.8.18: Exact gradient match - from-navy-900 to-navy-800 */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* V10.8.17: Exact copy of dashboard tab layout - centered, justified, breakpoint-aware */}
          <div className="hidden max-[850px]:hidden min-[850px]:flex gap-1 whitespace-nowrap pb-2 justify-center mx-auto">
            <button
              onClick={() => router.push('/dashboard?tab=overview')}
              className="shrink-0 px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => router.push('/dashboard?tab=residents')}
              className="shrink-0 px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Residents
              </div>
            </button>
            <button
              onClick={() => router.push('/dashboard?tab=rules')}
              className="shrink-0 px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                Access Rules
              </div>
            </button>
            <button
              onClick={() => router.push('/dashboard?tab=settings')}
              className="shrink-0 px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <SettingsIcon className="w-4 h-4" />
                Facility Settings
              </div>
            </button>
            <button
              onClick={() => router.push('/dashboard?tab=revenue')}
              className="shrink-0 px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                Revenue Analytics
              </div>
            </button>
            <button
              onClick={() => router.push('/dashboard?tab=occupancy')}
              className="shrink-0 px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                Current Occupancy
              </div>
            </button>
            <div className="shrink-0 px-3 py-2 text-sm font-semibold border-b-2 border-teal-400 text-white bg-white/10">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                All Activity
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* V10.8.16: Date Range Filter with Export button in same row */}
        <div className="bg-white rounded-lg border border-navy-200 p-4 mb-4">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Calendar className="w-5 h-5 text-navy-600" />
                <span className="text-sm font-semibold text-navy-900">Filter by Date Range:</span>
              </div>
              {/* V10.8.16: Export CSV button moved here */}
              <button
                onClick={exportActivityCSV}
                className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-navy-600">Start:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPage(1)
                  }}
                  className="px-3 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-navy-600">End:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setPage(1)
                  }}
                  className="px-3 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={clearDateFilter}
                  className="flex items-center space-x-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="text-sm font-medium">Clear Filter</span>
                </button>
              )}
            </div>
            {(startDate || endDate) && (
              <div className="text-sm text-navy-600">
                {/* V9.1 Fix #3: Parse dates as local time by appending T00:00:00 */}
                Showing logs {startDate && `from ${new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`} 
                {startDate && endDate && ' to '}
                {endDate && new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-white rounded-lg border border-navy-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-navy-600">
              Showing <span className="font-semibold text-navy-900">{logs.length}</span> of{' '}
              <span className="font-semibold text-navy-900">{total}</span> total logs
              {(startDate || endDate) && <span className="ml-1">(filtered)</span>}
            </div>
            <div className="text-sm text-navy-600">
              Page <span className="font-semibold text-navy-900">{page}</span> of{' '}
              <span className="font-semibold text-navy-900">{totalPages}</span>
            </div>
          </div>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-navy-600 animate-spin" />
            <span className="ml-3 text-navy-600">Loading logs...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`p-4 rounded-lg border-2 ${getLogStyles(log)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-1">{getLogIcon(log)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>{getLogLabel(log)}</div>
                      <div className="text-sm text-navy-500">{formatDate(log.scanned_at)}</div>
                    </div>
                    {getLogDetails(log)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center space-x-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-white border-2 border-navy-200 text-navy-700 hover:bg-navy-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Previous</span>
            </button>
            
            <div className="text-sm text-navy-600">
              Page {page} of {totalPages}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-white border-2 border-navy-200 text-navy-700 hover:bg-navy-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
