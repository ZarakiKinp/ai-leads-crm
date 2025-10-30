'use client'

import { useState, useEffect } from 'react'
import { Download, Upload, Trash2, FileText, Search } from 'lucide-react'

interface ScoredLead {
  id: number
  name: string
  ai_score: number
  ai_reason: string
  pipeline?: {
    id: number
    name: string
  }
  status?: {
    id: number
    name: string
  }
  responsible_user_id?: number
  phone?: Array<{ value: string }>
  email?: Array<{ value: string }>
  custom_fields_values?: Array<{
    field_id: number
    field_name: string
    values: Array<{ value: any }>
  }>
  created_at?: number
  updated_at?: number
}

export default function ScoredResults() {
  const [scoredLeads, setScoredLeads] = useState<ScoredLead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<ScoredLead[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [minScore, setMinScore] = useState<number | null>(null)
  const [maxScore, setMaxScore] = useState<number | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load scored leads from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scoredLeads')
      if (saved) {
        const parsed: ScoredLead[] = JSON.parse(saved)
        setScoredLeads(parsed)
        setFilteredLeads(parsed)
        console.log(`📊 Loaded ${parsed.length} scored leads`)
      }
    } catch (e) {
      console.error('Error loading scored leads:', e)
      setError('Failed to load scored leads')
    }
  }, [])

  // Filter leads based on search and score range
  useEffect(() => {
    let filtered = scoredLeads

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(lead => 
        lead.name.toLowerCase().includes(term) ||
        lead.ai_reason?.toLowerCase().includes(term) ||
        lead.pipeline?.name.toLowerCase().includes(term)
      )
    }

    // Score range filter
    if (minScore !== null || maxScore !== null) {
      filtered = filtered.filter(lead => {
        const score = lead.ai_score || 0
        const min = minScore !== null ? minScore : 0
        const max = maxScore !== null ? maxScore : 10
        return score >= min && score <= max
      })
    }

    setFilteredLeads(filtered)
  }, [searchTerm, minScore, maxScore, scoredLeads])

  // Export to CSV
  const exportToCSV = () => {
    try {
      if (filteredLeads.length === 0) {
        setError('No leads to export')
        return
      }

      // CSV headers
      const headers = [
        'ID',
        'Name',
        'AI Score',
        'AI Reason',
        'Pipeline',
        'Status',
        'Phone',
        'Email',
        'Created At',
        'Updated At'
      ]

      // CSV rows
      const rows = filteredLeads.map(lead => {
        const phone = lead.phone?.[0]?.value || ''
        const email = lead.email?.[0]?.value || ''
        const createdAt = lead.created_at ? new Date(lead.created_at * 1000).toLocaleDateString() : ''
        const updatedAt = lead.updated_at ? new Date(lead.updated_at * 1000).toLocaleDateString() : ''

        return [
          lead.id,
          `"${lead.name.replace(/"/g, '""')}"`, // Escape quotes
          lead.ai_score,
          `"${(lead.ai_reason || '').replace(/"/g, '""')}"`,
          `"${(lead.pipeline?.name || '').replace(/"/g, '""')}"`,
          `"${(lead.status?.name || '').replace(/"/g, '""')}"`,
          phone,
          email,
          createdAt,
          updatedAt
        ].join(',')
      })

      // Combine headers and rows
      const csv = [headers.join(','), ...rows].join('\n')

      // Create and download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `scored_leads_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSuccessMessage(`✅ Exported ${filteredLeads.length} leads to CSV`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (e) {
      console.error('Error exporting CSV:', e)
      setError('Failed to export CSV')
      setTimeout(() => setError(null), 3000)
    }
  }

  // Import from CSV
  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').map(line => line.trim()).filter(line => line)
        
        if (lines.length < 2) {
          setError('CSV file is empty or invalid')
          setTimeout(() => setError(null), 3000)
          return
        }
        
        // Skip header
        const dataLines = lines.slice(1)
        
        const imported: ScoredLead[] = []
        
        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i]
          
          // Better CSV parser that handles quoted fields with commas
          const parseCSVLine = (line: string): string[] => {
            const result: string[] = []
            let current = ''
            let inQuotes = false
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i]
              const nextChar = line[i + 1]
              
              if (char === '"') {
                if (inQuotes && nextChar === '"') {
                  // Escaped quote
                  current += '"'
                  i++ // Skip next quote
                } else {
                  // Toggle quote state
                  inQuotes = !inQuotes
                }
              } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current)
                current = ''
              } else {
                current += char
              }
            }
            
            // Push last field
            result.push(current)
            return result
          }
          
          const values = parseCSVLine(line)
          
          if (values.length >= 6) {
            try {
              const id = parseInt(values[0])
              const name = values[1]
              const ai_score = parseFloat(values[2])
              const ai_reason = values[3]
              
              if (!isNaN(id) && !isNaN(ai_score) && name && ai_reason) {
                const lead: ScoredLead = {
                  id,
                  name,
                  ai_score,
                  ai_reason,
                  pipeline: values[4] && values[4].trim() ? { id: 0, name: values[4] } : undefined,
                  status: values[5] && values[5].trim() ? { id: 0, name: values[5] } : undefined,
                  phone: values[6] && values[6].trim() ? [{ value: values[6] }] : undefined,
                  email: values[7] && values[7].trim() ? [{ value: values[7] }] : undefined
                }
                
                imported.push(lead)
              }
            } catch (err) {
              console.warn(`Skipping line ${i + 2}: ${err}`)
            }
          }
        }

        if (imported.length > 0) {
          // Merge with existing leads (avoid duplicates by ID)
          const merged = [...scoredLeads]
          const existingIds = new Set(scoredLeads.map(l => l.id))
          
          let newCount = 0
          for (const lead of imported) {
            if (!existingIds.has(lead.id)) {
              merged.push(lead)
              newCount++
            }
          }

          setScoredLeads(merged)
          localStorage.setItem('scoredLeads', JSON.stringify(merged))
          setSuccessMessage(`✅ Imported ${newCount} new leads from CSV (${imported.length} total in file, ${imported.length - newCount} duplicates skipped)`)
          setTimeout(() => setSuccessMessage(null), 5000)
        } else {
          setError('No valid leads found in CSV. Please check the file format.')
          setTimeout(() => setError(null), 3000)
        }
      } catch (e) {
        console.error('Error importing CSV:', e)
        setError(`Failed to import CSV: ${e}`)
        setTimeout(() => setError(null), 5000)
      }
    }

    reader.readAsText(file)
    event.target.value = '' // Reset input
  }

  // Clear all results
  const clearAllResults = () => {
    if (confirm('Are you sure you want to delete all scored results? This cannot be undone.')) {
      setScoredLeads([])
      setFilteredLeads([])
      localStorage.removeItem('scoredLeads')
      setSuccessMessage('✅ All scored results cleared')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }

  // Delete selected lead
  const deleteLead = (id: number) => {
    const updated = scoredLeads.filter(lead => lead.id !== id)
    setScoredLeads(updated)
    localStorage.setItem('scoredLeads', JSON.stringify(updated))
    setSuccessMessage('✅ Lead deleted')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const getScoreColor = (score: number): string => {
    if (score >= 8) return 'text-green-600 bg-green-50'
    if (score >= 6) return 'text-yellow-600 bg-yellow-50'
    if (score >= 4) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  const getScoreBadge = (score: number): string => {
    if (score >= 8) return 'bg-green-600'
    if (score >= 6) return 'bg-yellow-600'
    if (score >= 4) return 'bg-orange-600'
    return 'bg-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-primary-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Scored Results</h3>
              <p className="text-sm text-gray-600">Manage and export your AI-scored leads</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className="btn-primary flex items-center space-x-2"
              disabled={filteredLeads.length === 0}
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <label className="btn-secondary flex items-center space-x-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              <span>Import CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={importFromCSV}
                className="hidden"
              />
            </label>
            <button
              onClick={clearAllResults}
              className="btn-secondary text-red-600 flex items-center space-x-2"
              disabled={scoredLeads.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Leads</p>
            <p className="text-2xl font-bold text-blue-600">{scoredLeads.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">High Score (8-10)</p>
            <p className="text-2xl font-bold text-green-600">
              {scoredLeads.filter(l => l.ai_score >= 8).length}
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Medium Score (6-7)</p>
            <p className="text-2xl font-bold text-yellow-600">
              {scoredLeads.filter(l => l.ai_score >= 6 && l.ai_score < 8).length}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Low Score (1-5)</p>
            <p className="text-2xl font-bold text-red-600">
              {scoredLeads.filter(l => l.ai_score < 6).length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">Score Range:</label>
            <input
              type="number"
              min="0"
              max="10"
              placeholder="Min"
              value={minScore ?? ''}
              onChange={(e) => setMinScore(e.target.value ? Number(e.target.value) : null)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              min="0"
              max="10"
              placeholder="Max"
              value={maxScore ?? ''}
              onChange={(e) => setMaxScore(e.target.value ? Number(e.target.value) : null)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {(searchTerm || minScore !== null || maxScore !== null) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setMinScore(null)
                setMaxScore(null)
              }}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Results Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pipeline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {scoredLeads.length === 0 
                      ? 'No scored leads yet. Start scoring leads to see results here.'
                      : 'No leads match your filters.'
                    }
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                      <div className="text-sm text-gray-500">ID: {lead.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(lead.ai_score)}`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${getScoreBadge(lead.ai_score)}`}></span>
                        {lead.ai_score}/10
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md truncate" title={lead.ai_reason}>
                        {lead.ai_reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{lead.pipeline?.name || '-'}</div>
                      <div className="text-sm text-gray-500">{lead.status?.name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{lead.phone?.[0]?.value || '-'}</div>
                      <div className="text-sm text-gray-500">{lead.email?.[0]?.value || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Showing count */}
      {filteredLeads.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Showing {filteredLeads.length} of {scoredLeads.length} scored leads
        </div>
      )}
    </div>
  )
}

