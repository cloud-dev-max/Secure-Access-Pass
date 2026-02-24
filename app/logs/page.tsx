'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, MessageSquare, LogIn, LogOut, ArrowLeft, ChevronLeft, ChevronRight, Loader2, Calendar, X, Download } from 'lucide-react'

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
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  // V9.0 Feature #2: Date range picker
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  useEffect(() => {
    loadLogs(page)
  }, [page, startDate, endDate]) // V9.0: Reload when date range changes

  const loadLogs = async (pageNum: number) => {
    try {
      setLoading(true)
      // V9.0 Feature #2: Add date range parameters if set
      let url = `/api/logs?page=${pageNum}&limit=50`
      if (startDate) {
        url += `&startDate=${startDate}`
      }
      if (endDate) {
        url += `&endDate=${endDate}`
      }
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
  const exportActivityCSV = async () => {
    try {
      // Build URL with date range if set
      let url = '/api/activity-logs?limit=5000';
      if (startDate) {
        url += `&startDate=${startDate}`
      }
      if (endDate) {
        url += `&endDate=${endDate}`
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch activity logs');
      
      const data = await response.json();
      const logs = data.logs || [];
      
      const headers = ['Timestamp', 'Name', 'Type', 'Action', 'Result', 'Unit', 'Guests', 'Total People'];
      const rows = logs.map((log: any) => {
        // V9.1 Fix #2: Correct field mapping - use scanned_at and nested user object
        const timestamp = log.scanned_at ? new Date(log.scanned_at).toLocaleString() : 'N/A'
        const name = log.user?.name || log.profile?.name || 'Unknown'
        const unit = log.user?.unit || log.profile?.unit || 'N/A'
        
        // V9.1 Fix #2: Detect visitor passes and system events
        const isVisitorPass = log.qr_code?.startsWith('GUEST-') || log.qr_code?.startsWith('VISITOR-')
        const isSystemEvent = log.qr_code === 'STATUS_CHANGE' || log.qr_code === 'SYSTEM_BROADCAST'
        
        let type = 'Resident'
        if (isSystemEvent) {
          type = 'System Event'
        } else if (isVisitorPass) {
          type = 'Visitor Pass'
        }
        
        const action = log.scan_type || 'SCAN'
        const result = log.result || 'N/A'
        const guests = log.guest_count || 0
        
        // V9.2 Feature #5: Total People = primary person (1) + guests
        const totalPeople = 1 + guests
        
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
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
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
      {/* Header */}
      <div className="bg-white border-b border-navy-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-navy-600 hover:text-navy-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-navy-900">Full Activity Log</h1>
            {/* V8.12 UX #4: Export Activity CSV */}
            <button
              onClick={exportActivityCSV}
              className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* V9.0 Feature #2: Date Range Filter */}
        <div className="bg-white rounded-lg border border-navy-200 p-4 mb-4">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center space-x-4">
              <Calendar className="w-5 h-5 text-navy-600" />
              <span className="text-sm font-semibold text-navy-900">Filter by Date Range:</span>
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
