'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, MessageSquare, LogIn, LogOut, ArrowLeft, ChevronLeft, ChevronRight, Loader2, Calendar, X } from 'lucide-react'

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
  const [selectedDate, setSelectedDate] = useState<string>('') // V8.3 Fix #3: Date filter

  useEffect(() => {
    loadLogs(page)
  }, [page, selectedDate]) // V8.3: Reload when date filter changes

  const loadLogs = async (pageNum: number) => {
    try {
      setLoading(true)
      // V8.3 Fix #3: Add date parameter if filter is set
      let url = `/api/logs?page=${pageNum}&limit=50`
      if (selectedDate) {
        url += `&date=${selectedDate}`
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

  // V8.3 Fix #3: Clear date filter and reload
  const clearDateFilter = () => {
    setSelectedDate('')
    setPage(1) // Reset to first page
  }

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
    const isStatusChange = log.qr_code === 'STATUS_CHANGE' || (log.denial_reason && log.denial_reason.includes('Status changed from'))
    const isSystemBroadcast = log.qr_code === 'SYSTEM_BROADCAST' || (log.denial_reason && log.denial_reason.includes('BROADCAST'))
    
    if (isStatusChange) {
      return <span className="font-semibold text-indigo-900">Pool Status Change</span>
    }
    if (isSystemBroadcast) {
      return <span className="font-semibold text-orange-900">System Broadcast</span>
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
            <div className="w-32"></div> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* V8.3 Fix #3: Date Filter */}
        <div className="bg-white rounded-lg border border-navy-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Calendar className="w-5 h-5 text-navy-600" />
              <span className="text-sm font-semibold text-navy-900">Filter by Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setPage(1) // Reset to first page when filter changes
                }}
                className="px-3 py-2 border-2 border-navy-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              {selectedDate && (
                <button
                  onClick={clearDateFilter}
                  className="flex items-center space-x-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span className="text-sm font-medium">Clear Date</span>
                </button>
              )}
            </div>
            {selectedDate && (
              <div className="text-sm text-navy-600">
                Showing logs for: <span className="font-semibold text-navy-900">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
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
              {selectedDate && <span className="ml-1">(filtered)</span>}
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
