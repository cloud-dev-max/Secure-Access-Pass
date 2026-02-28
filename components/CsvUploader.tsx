'use client'

import { useState } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react'

interface CsvUploaderProps {
  onUploadComplete: () => void
  propertyId: string // V10.8.1: Multi-tenancy support
}

interface ParsedResident {
  name: string
  email: string
  unit: string
  phone?: string
}

export default function CsvUploader({ onUploadComplete, propertyId }: CsvUploaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<{
    success: any[]
    failed: any[]
  } | null>(null)

  const parseCSV = (text: string): ParsedResident[] => {
    const lines = text.trim().split('\n')
    
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row')
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    
    // Validate required columns
    const requiredColumns = ['name', 'unit', 'email']
    const missingColumns = requiredColumns.filter(col => !header.includes(col))
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}. CSV must have: name, unit, email (phone is optional)`)
    }

    // Parse data rows
    const residents: ParsedResident[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Skip empty lines
      
      const values = line.split(',').map(v => v.trim())
      const resident: any = {}
      
      header.forEach((col, idx) => {
        resident[col] = values[idx] || ''
      })
      
      // Validate required fields
      if (resident.name && resident.email && resident.unit) {
        residents.push({
          name: resident.name,
          email: resident.email,
          unit: resident.unit,
          phone: resident.phone || undefined,
        })
      }
    }

    if (residents.length === 0) {
      throw new Error('No valid residents found in CSV file')
    }

    return residents
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setResults(null)

    try {
      // Read file
      const text = await file.text()
      
      // Parse CSV
      const residents = parseCSV(text)
      
      // V10.8.1: Upload to API with property_id for multi-tenancy
      const response = await fetch('/api/residents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residents, property_id: propertyId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload residents')
      }

      setResults(data.results)
      
      // Notify parent component
      if (data.results.success.length > 0) {
        setTimeout(() => {
          onUploadComplete()
        }, 2000)
      }
    } catch (error) {
      console.error('CSV upload error:', error)
      alert(error instanceof Error ? error.message : 'Failed to process CSV file')
    } finally {
      setIsProcessing(false)
      // Reset file input
      event.target.value = ''
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-navy-600 hover:bg-navy-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
      >
        <Upload className="w-5 h-5" />
        Import CSV
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-navy-900 to-navy-800 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6" />
                  <h2 className="text-2xl font-bold">Bulk Import Residents</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-navy-900 mb-2">CSV Format Requirements</h3>
                <p className="text-sm text-navy-700 mb-2">
                  Your CSV file must have the following columns (in any order):
                </p>
                <ul className="text-sm text-navy-700 space-y-1 ml-4">
                  <li>• <strong>name</strong> - Full name (required)</li>
                  <li>• <strong>email</strong> - Email address (required)</li>
                  <li>• <strong>unit</strong> - Unit number (required)</li>
                  <li>• <strong>phone</strong> - Phone number (optional)</li>
                </ul>
                <div className="mt-3 text-sm text-navy-700">
                  <strong>Example CSV:</strong>
                  <pre className="bg-white p-2 rounded mt-1 text-xs">
name,email,unit,phone{'\n'}
John Doe,john@example.com,101,555-1234{'\n'}
Jane Smith,jane@example.com,102,555-5678
                  </pre>
                </div>
              </div>

              {/* Upload Section */}
              {!results && (
                <div className="border-2 border-dashed border-navy-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-navy-400 mx-auto mb-4" />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                      className="hidden"
                    />
                    <span className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold inline-block transition-all">
                      {isProcessing ? 'Processing...' : 'Choose CSV File'}
                    </span>
                  </label>
                  <p className="text-sm text-navy-600 mt-3">
                    Click to select a CSV file from your computer
                  </p>
                </div>
              )}

              {/* Results */}
              {results && (
                <div className="space-y-4">
                  {/* Success */}
                  {results.success.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-900 mb-1">
                            Successfully Imported: {results.success.length}
                          </h4>
                          <div className="text-sm text-green-700 max-h-40 overflow-auto">
                            {results.success.map((resident, idx) => (
                              <div key={idx} className="py-1">
                                {resident.name} - Unit {resident.unit}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Failures */}
                  {results.failed.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-red-900 mb-1">
                            Failed to Import: {results.failed.length}
                          </h4>
                          <div className="text-sm text-red-700 max-h-40 overflow-auto">
                            {results.failed.map((item, idx) => (
                              <div key={idx} className="py-1">
                                {item.data.name || 'Unknown'} - {item.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setResults(null)
                        setIsOpen(false)
                      }}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => setResults(null)}
                      className="flex-1 bg-navy-200 hover:bg-navy-300 text-navy-900 px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                      Import Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
