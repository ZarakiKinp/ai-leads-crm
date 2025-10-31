'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Brain, 
  Target, 
  Users, 
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  BarChart3
} from 'lucide-react'
import { kommoClient, isLeadClosed } from '@/lib/kommo-client'
import { aiScorer } from '@/lib/ai-scorer'
import { Lead, ScoredLead } from '@/lib/kommo-client'

export default function LeadScoring() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [scoredLeads, setScoredLeads] = useState<ScoredLead[]>([])
  const [loading, setLoading] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentLead, setCurrentLead] = useState('')
  const [shouldStop, setShouldStop] = useState(false)
  const [numLeads, setNumLeads] = useState(50)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  const [scoringMode, setScoringMode] = useState<'all' | 'selected'>('all')
  const [pipelines, setPipelines] = useState<any[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null)
  const [scanMode, setScanMode] = useState<'all' | 'pipeline'>('all')
  const [onlyUnscored, setOnlyUnscored] = useState(true)
  const [scoreAll, setScoreAll] = useState(false)

  // Guards to prevent duplicate fetches in dev StrictMode / Fast Refresh
  const loadedSavedRef = useRef(false)
  const pipelinesFetchedRef = useRef(false)
  const fetchedAllLeadsRef = useRef(false)
  const fetchedPipelineIdsRef = useRef<Set<number>>(new Set())

  // Load saved scored results once on mount so results persist across navigations
  useEffect(() => {
    if (loadedSavedRef.current) return
    loadedSavedRef.current = true
    try {
      const saved = localStorage.getItem('scoredLeads')
      if (saved) {
        const parsed: ScoredLead[] = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const openOnly = parsed.filter(l => !isLeadClosed(l))
          setScoredLeads(openOnly)
          console.log(`📁 Loaded ${openOnly.length} saved OPEN scored leads from localStorage (filtered from ${parsed.length})`)
        }
      }
    } catch (e) {
      console.error('Error loading saved scoredLeads from localStorage:', e)
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        if (!pipelinesFetchedRef.current) {
          const pipelinesData = await kommoClient.getPipelines()
          setPipelines(pipelinesData)
          pipelinesFetchedRef.current = true
        } else {
          console.log('⚡ Skipping refetch of pipelines (already loaded this session)')
        }
        
        // Only load all leads if not in pipeline mode
        if (scanMode === 'all') {
          if (!fetchedAllLeadsRef.current) {
            const allLeads = await kommoClient.getAllLeads()
            const openLeads = allLeads.filter(l => !isLeadClosed(l))
            setLeads(openLeads)
            fetchedAllLeadsRef.current = true
          } else {
            console.log('⚡ Skipping refetch of all leads (already loaded this session)')
          }
        }
      } catch (err) {
        setError('Failed to load data')
        console.error('Error fetching data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const selectAllLeads = () => {
    const allLeadIds = leads.slice(0, numLeads).map(lead => lead.id)
    setSelectedLeads(allLeadIds)
  }

  const clearSelection = () => {
    setSelectedLeads([])
  }

  const handleStopScanning = () => {
    setShouldStop(true)
    setScoring(false)
    console.log('🛑 Scanning stopped by user')
    
    // Save current results to localStorage when stopping
    try {
      const currentScoredLeads = JSON.parse(localStorage.getItem('scoredLeads') || '[]')
      if (currentScoredLeads.length > 0) {
        console.log(`💾 Final save: ${currentScoredLeads.length} scored leads saved to localStorage`)
      }
    } catch (storageError) {
      console.error('Error saving final results to localStorage:', storageError)
    }
  }

  const handlePipelineChange = async (pipelineId: number | null) => {
    setSelectedPipeline(pipelineId)
    if (pipelineId && scanMode === 'pipeline') {
      try {
        setLoading(true)
        setError(null)
        if (!fetchedPipelineIdsRef.current.has(pipelineId)) {
          const pipelineLeads = await kommoClient.getLeadsFromPipeline(pipelineId, numLeads)
          const openLeads = pipelineLeads.filter(l => !isLeadClosed(l))
          setLeads(openLeads)
          fetchedPipelineIdsRef.current.add(pipelineId)
          console.log(`📊 Loaded ${pipelineLeads.length} leads from pipeline ${pipelineId}`)
        } else {
          console.log(`⚡ Skipping refetch for pipeline ${pipelineId} (already loaded this session)`)        
        }
      } catch (err) {
        setError('Failed to load leads from pipeline')
        console.error('Error fetching pipeline leads:', err)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleScoreLeads = async () => {
    try {
      setScoring(true)
      setProgress(0)
      setError(null)
      setShouldStop(false) // Reset stop flag when starting new scan
      
      // Determine which leads to score based on mode
      let leadsToScore: Lead[]
      if (scoringMode === 'selected') {
        if (selectedLeads.length === 0) {
          setError('Please select at least one lead to score')
          setScoring(false)
          return
        }
        leadsToScore = leads.filter(lead => selectedLeads.includes(lead.id))
      } else if (scanMode === 'pipeline' && selectedPipeline) {
        // Fetch leads from specific pipeline
        console.log(`🔍 Fetching leads from pipeline ${selectedPipeline}...`)
        const pipelineLeads = await kommoClient.getLeadsFromPipeline(selectedPipeline, numLeads)
        // Ensure closed leads are excluded even in on-demand fetch
        const openPipelineLeads = pipelineLeads.filter(l => !isLeadClosed(l))
        leadsToScore = scoreAll ? openPipelineLeads : openPipelineLeads.slice(0, numLeads)
      } else {
        leadsToScore = scoreAll ? leads : leads.slice(0, numLeads)
      }

      // Build set of already-scored lead IDs (from state + any localStorage)
      let alreadyScoredIds = new Set<number>(scoredLeads.map(l => l.id))
      try {
        const saved = localStorage.getItem('scoredLeads')
        if (saved) {
          const parsed: ScoredLead[] = JSON.parse(saved)
          parsed.forEach(l => alreadyScoredIds.add(l.id))
        }
      } catch {}

      // Optionally skip already-scored leads to minimize API usage
      if (onlyUnscored) {
        const originalCount = leadsToScore.length
        leadsToScore = leadsToScore.filter(l => !alreadyScoredIds.has(l.id))
        console.log(`🧠 Only-unscored mode: ${originalCount - leadsToScore.length} leads skipped, ${leadsToScore.length} to score`)
      }
      
      // Exclude closed leads from scoring entirely
      const originalCount = leadsToScore.length
      leadsToScore = leadsToScore.filter(lead => !isLeadClosed(lead))
      const skippedClosed = originalCount - leadsToScore.length
      console.log(`📊 Scanning ${leadsToScore.length} open leads${skippedClosed > 0 ? ` (skipped ${skippedClosed} closed)` : ''}`)
      
      // Fetch communications for each lead before scoring
      console.log('📞 Fetching communications for leads...')
      const leadsWithCommunications = []
      
      for (let i = 0; i < leadsToScore.length; i++) {
        // Check if user wants to stop
        if (shouldStop) {
          console.log('🛑 Stopping communication fetching due to user request')
          break
        }
        
        const lead = leadsToScore[i]
        setCurrentLead(lead.name || 'Unknown')
        setProgress((i / leadsToScore.length) * 50) // First 50% for fetching communications
        
        try {
          // Re-fetch lead with embedded data to get complete contact/company info
          const fullLeadData = await kommoClient.getLeadById(lead.id)
          const communications = await kommoClient.getLeadCommunications(lead.id)
          leadsWithCommunications.push({
            ...fullLeadData,
            messages: communications.messages,
            notes: communications.notes
          })
          console.log(`📞 Fetched complete data for lead ${lead.id}: ${communications.messages.length} messages and ${communications.notes.length} notes`)
        } catch (commError) {
          console.error(`❌ Error fetching complete data for lead ${lead.id}:`, commError)
          // Still include the lead without communications
          leadsWithCommunications.push({
            ...lead,
            messages: [],
            notes: []
          })
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      console.log('🤖 Starting AI scoring with communication data...')
      
      // Process leads one by one to show results in real-time
      const newlyScored: ScoredLead[] = []
      const activeScored = []
      const highScoreLeads = []
      
      for (let i = 0; i < leadsWithCommunications.length; i++) {
        // Check if user wants to stop
        if (shouldStop) {
          console.log('🛑 Stopping AI scoring due to user request')
          break
        }
        
        const lead = leadsWithCommunications[i]
        setCurrentLead(lead.name || 'Unknown')
        setProgress(50 + ((i + 1) / leadsWithCommunications.length) * 50) // Second 50% for processing
        
        try {
          // Score individual lead
          const scoredLead = await aiScorer.scoreSingleLead(lead)
          newlyScored.push(scoredLead)
          
          // Add to active scored if not closed
          if (!isLeadClosed(scoredLead)) {
            activeScored.push(scoredLead)
            
            // Collect high-scoring active leads
            if (scoredLead.ai_score >= 5) {
              highScoreLeads.push(scoredLead)
            }
          }
          
          // Incrementally merge with existing results for live feedback (open leads only)
          setScoredLeads(prev => {
            const map = new Map<number, ScoredLead>()
            // keep previous
            prev.forEach(p => { if (!isLeadClosed(p)) map.set(p.id, p) })
            // add newly scored so far
            newlyScored.forEach(n => { if (!isLeadClosed(n)) map.set(n.id, n) })
            return Array.from(map.values())
          })
          
          // Save to localStorage after each lead is scored (for stop functionality)
          try {
            const currentMerged = (() => {
              const map = new Map<number, ScoredLead>()
              scoredLeads.forEach(p => { if (!isLeadClosed(p)) map.set(p.id, p) })
              newlyScored.forEach(n => { if (!isLeadClosed(n)) map.set(n.id, n) })
              return Array.from(map.values())
            })()
            localStorage.setItem('scoredLeads', JSON.stringify(currentMerged))
            console.log(`💾 Saved ${currentMerged.length} scored leads to localStorage`)
          } catch (storageError) {
            console.error('Error saving scored leads to localStorage:', storageError)
          }
          
          console.log(`✅ Scored lead ${scoredLead.name}: ${scoredLead.ai_score}/10 ${isLeadClosed(scoredLead) ? '(closed - analyzed only)' : ''}`)
          
        } catch (error: any) {
          console.error(`❌ Error scoring lead ${lead.name}:`, error)
          
          // Check if this is a rate limit error - if so, stop immediately
          if (error.name === 'RateLimitError') {
            console.error('🛑 RATE LIMIT ERROR - Stopping scoring process immediately')
            setError(`OpenAI API Rate Limit Reached: ${error.message}. Scoring has been stopped. You have scored ${newlyScored.length} lead(s) successfully. Please wait and try again later, or upgrade your OpenAI plan for higher rate limits.`)
            setShouldStop(true) // This will stop the loop on next iteration
            break // Exit the loop immediately
          }
          
          // For other errors, add lead with error and continue
          const errorLead = {
            ...lead,
            ai_score: 5,
            ai_reason: `Error: ${error}`
          }
          newlyScored.push(errorLead)
          
          // Add to active scored if not closed
          if (!isLeadClosed(errorLead)) {
            activeScored.push(errorLead)
          }
          
          setScoredLeads(prev => {
            const map = new Map<number, ScoredLead>()
            prev.forEach(p => { if (!isLeadClosed(p)) map.set(p.id, p) })
            newlyScored.forEach(n => { if (!isLeadClosed(n)) map.set(n.id, n) })
            return Array.from(map.values())
          })
          
          // Save to localStorage after each lead (including errors)
          try {
            const currentMerged = (() => {
              const map = new Map<number, ScoredLead>()
              scoredLeads.forEach(p => { if (!isLeadClosed(p)) map.set(p.id, p) })
              newlyScored.forEach(n => { if (!isLeadClosed(n)) map.set(n.id, n) })
              return Array.from(map.values())
            })()
            localStorage.setItem('scoredLeads', JSON.stringify(currentMerged))
            console.log(`💾 Saved ${currentMerged.length} scored leads to localStorage`)
          } catch (storageError) {
            console.error('Error saving scored leads to localStorage:', storageError)
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      setScoring(false)
      
      // Final save to localStorage (especially important when stopped)
      try {
        const merged = (() => {
          const map = new Map<number, ScoredLead>()
          // previous
          scoredLeads.forEach(p => { if (!isLeadClosed(p)) map.set(p.id, p) })
          // new
          newlyScored.forEach(n => { if (!isLeadClosed(n)) map.set(n.id, n) })
          return Array.from(map.values())
        })()
        localStorage.setItem('scoredLeads', JSON.stringify(merged))
        console.log(`💾 Final save: ${merged.length} scored leads saved to localStorage`)
      } catch (storageError) {
        console.error('Error saving final scored leads to localStorage:', storageError)
      }
      
      // Show success message with error details if any
      const errorLeads = activeScored.filter(lead => lead.ai_reason?.includes('Error'))
      const successLeads = activeScored.filter(lead => !lead.ai_reason?.includes('Error'))
      
      let message = shouldStop 
        ? `🛑 Scanning stopped by user. Processed ${newlyScored.length} new open leads! `
        : `✅ Processed ${newlyScored.length} new open leads! `
      message += `Total saved scored leads: ${(() => { try { return JSON.parse(localStorage.getItem('scoredLeads')||'[]').length } catch { return scoredLeads.length } })()}, `
      message += `Open leads processed: ${activeScored.length}, `
      message += `High-scoring open: ${highScoreLeads.length}`
      
      if (errorLeads.length > 0) {
        message += `\n⚠️ Some active leads had scoring errors (check console for details)`
      }
      
      setSuccessMessage(message)
      console.log(`✅ Successfully processed ${newlyScored.length} leads total!`)
      console.log(`📊 Active leads: ${activeScored.length}`)
      console.log(`📊 Success: ${successLeads.length}, Errors: ${errorLeads.length}`)
      console.log(`⭐ Found ${highScoreLeads.length} high-scoring active leads (score ≥ 5)`)
    } catch (err) {
      setError('Failed to score leads')
      setScoring(false)
      console.error('Error scoring leads:', err)
    }
  }

  const highScoreLeads = scoredLeads.filter(lead => lead.ai_score >= 5 && !isLeadClosed(lead))
  const activeScored = scoredLeads.filter(lead => !isLeadClosed(lead))
  const scoreDistribution = activeScored.reduce((acc, lead) => {
    acc[lead.ai_score] = (acc[lead.ai_score] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  if (loading) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Score Leads</h3>
          <p className="text-gray-600 text-center mb-6">
            Fetching leads and preparing AI scoring system...
          </p>
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Loading...</span>
              <span className="text-sm text-gray-500">Please wait</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Configuration */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <Brain className="h-6 w-6 text-primary-600 mr-3" />
          <h3 className="text-lg font-semibold text-gray-900">AI Lead Scoring Configuration</h3>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={onlyUnscored}
                onChange={(e) => setOnlyUnscored(e.target.checked)}
              />
              <span>Only score unscored</span>
            </label>
            <button
              onClick={() => {
                try {
                  localStorage.setItem('scoredLeads', JSON.stringify(scoredLeads))
                  setSuccessMessage(`💾 Saved ${scoredLeads.length} scored leads! View them in "Scored Results" tab.`)
                } catch (e) {
                  setError('Failed to save results locally')
                }
              }}
              className="btn-secondary text-sm"
              title="Save scored results to view in Scored Results page"
            >
              Save Results
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scoring Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scoring Mode
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="scoringMode"
                  value="all"
                  checked={scoringMode === 'all'}
                  onChange={(e) => setScoringMode(e.target.value as 'all' | 'selected')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Score All Leads</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="scoringMode"
                  value="selected"
                  checked={scoringMode === 'selected'}
                  onChange={(e) => setScoringMode(e.target.value as 'all' | 'selected')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Score Selected Leads</span>
              </label>
            </div>
          </div>

          {/* Scan Mode Selection */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Mode</h3>
            <div className="flex space-x-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="scanMode"
                  value="all"
                  checked={scanMode === 'all'}
                  onChange={(e) => setScanMode(e.target.value as 'all' | 'pipeline')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Scan All Pipelines</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="scanMode"
                  value="pipeline"
                  checked={scanMode === 'pipeline'}
                  onChange={(e) => setScanMode(e.target.value as 'all' | 'pipeline')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Scan Specific Pipeline</span>
              </label>
            </div>
            
            {scanMode === 'pipeline' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Pipeline
                </label>
                <select
                  value={selectedPipeline || ''}
                  onChange={(e) => handlePipelineChange(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Choose a pipeline...</option>
                  {pipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Leads to Score
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="1"
                max={Math.max(1, leads.length || 1)}
                value={Math.min(numLeads, Math.max(1, leads.length || 1))}
                onChange={(e) => setNumLeads(parseInt(e.target.value))}
                className="flex-1"
                disabled={scoring || scoreAll}
              />
              <span className="text-sm font-medium text-gray-900 min-w-0">
                {scoreAll ? 'All' : `${numLeads} leads`}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">
                Available: {leads.length} leads. Estimated time: {(() => { const n = scoreAll ? leads.length : numLeads; return `${Math.ceil((n*2)/60)}m ${(n*2)%60}s` })()}
              </p>
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input type="checkbox" checked={scoreAll} onChange={(e) => setScoreAll(e.target.checked)} disabled={scoring} />
                <span>All</span>
              </label>
            </div>
          </div>
          
          <div className="flex items-end space-x-3">
            {scoringMode === 'selected' && (
              <>
              <button
                  onClick={selectAllLeads}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <CheckCircle className="h-4 w-4" />
                <span>Select All ({(scoreAll ? leads : leads.slice(0, numLeads)).length})</span>
                </button>
                <button
                  onClick={clearSelection}
                  className="btn-secondary"
                >
                  Clear Selection
                </button>
              </>
            )}
            <div className="flex space-x-2">
              <button
                onClick={handleScoreLeads}
                disabled={scoring || leads.length === 0 || (scoringMode === 'selected' && selectedLeads.length === 0)}
                className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scoring ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Scoring...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Start Scoring</span>
                  </>
                )}
              </button>
              
              {scoring && (
                <button
                  onClick={handleStopScanning}
                  className="btn-secondary flex items-center space-x-2 bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Stop Scanning</span>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {scoring && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {progress < 50 ? 'Fetching communications...' : 'Scoring leads...'}
              </span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {progress < 50 ? `Fetching communications for: ${currentLead}` : `Processing: ${currentLead}`}
            </p>
            
            {/* Real-time results counter */}
            {scoredLeads.length > 0 && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">
                    ✅ {scoredLeads.length} leads scored so far
                  </span>
                  <span className="text-xs text-blue-600">
                    {scoredLeads.filter(lead => lead.ai_score >= 5).length} high-scoring
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="card">
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center text-green-800">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {/* Lead Selection (when in selected mode) */}
      {scoringMode === 'selected' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Users className="h-5 w-5 mr-2 text-primary-600" />
            Select Leads to Score ({selectedLeads.length} selected)
          </h3>
          
          <div className="table-container">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header w-12">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === (scoreAll ? leads : leads.slice(0, numLeads)).length && (scoreAll ? leads : leads.slice(0, numLeads)).length > 0}
                      onChange={(e) => e.target.checked ? selectAllLeads() : clearSelection()}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="table-header">Name</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Pipeline</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Price</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(scoreAll ? leads : leads.slice(0, numLeads)).map((lead) => {
                  const isClosed = isLeadClosed(lead)
                  return (
                  <tr key={lead.id} className={`hover:bg-gray-50 ${isClosed ? 'bg-blue-50 border-l-4 border-blue-300' : ''}`}>
                    <td className="table-cell">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => toggleLeadSelection(lead.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="table-cell font-medium text-gray-900">
                      <div className="flex items-center">
                        {isClosed && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mr-2">
                            CLOSED (will analyze)
                          </span>
                        )}
                        {lead.name}
                      </div>
                    </td>
                    <td className="table-cell text-gray-600">{lead.company_name || 'No company'}</td>
                    <td className="table-cell text-gray-600">{lead.pipeline?.name || 'Unknown'}</td>
                    <td className="table-cell">
                      <span className="badge badge-info">
                        {lead.status?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-600">${lead.price || 0}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {leads.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No leads available for selection.
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {scoredLeads.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="metric-card">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Scored</p>
                  <p className="text-2xl font-bold text-gray-900">{scoredLeads.length}</p>
                </div>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="flex items-center">
                <Star className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">High-Score (≥5)</p>
                  <p className="text-2xl font-bold text-gray-900">{highScoreLeads.length}</p>
                </div>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {activeScored.length > 0 ? Math.round((highScoreLeads.length / activeScored.length) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Avg Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {activeScored.length > 0 
                      ? (activeScored.reduce((sum, lead) => sum + lead.ai_score, 0) / activeScored.length).toFixed(1)
                      : '0'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Score Distribution Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Score Distribution</h3>
            <div className="space-y-3">
              {Object.entries(scoreDistribution)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([score, count]) => (
                  <div key={score} className="flex items-center space-x-4">
                    <div className="w-12 text-sm font-medium text-gray-700">Score {score}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div 
                        className="bg-primary-600 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${(count / activeScored.length) * 100}%` }}
                      ></div>
                    </div>
                    <div className="w-16 text-sm text-gray-600">{count} leads</div>
                  </div>
                ))}
            </div>
          </div>

          {/* All Scored Leads */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">All Scored Leads</h3>
            <div className="table-container">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">Company</th>
                    <th className="table-header">AI Score</th>
                    <th className="table-header">Reason</th>
                    <th className="table-header">Pipeline</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scoredLeads.map((lead) => {
                    const hasError = lead.ai_reason?.includes('Error')
                    const isClosed = isLeadClosed(lead)
                    return (
                    <tr key={lead.id} className={`hover:bg-gray-50 ${hasError ? 'bg-red-50' : ''} ${isClosed ? 'bg-blue-50 border-l-4 border-blue-300' : ''}`}>
                      <td className="table-cell font-medium text-gray-900">
                        <div className="flex items-center">
                          {hasError && <AlertCircle className="h-4 w-4 text-red-500 mr-2" />}
                          {isClosed && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mr-2">
                              CLOSED
                            </span>
                          )}
                          {lead.name}
                        </div>
                      </td>
                      <td className="table-cell text-gray-600">{lead.company_name || 'No company'}</td>
                      <td className="table-cell">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-500 mr-1" />
                          <span className={`font-bold ${
                            lead.ai_score >= 7 ? 'text-green-600' :
                            lead.ai_score >= 5 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {lead.ai_score}/10
                          </span>
                        </div>
                      </td>
                      <td className="table-cell text-sm text-gray-600 max-w-md">
                        <div className="whitespace-normal break-words">
                          {lead.ai_reason}
                        </div>
                      </td>
                      <td className="table-cell text-gray-600">{lead.pipeline?.name || 'Unknown'}</td>
                      <td className="table-cell">
                        <span className={`badge ${
                          lead.ai_score >= 7 ? 'badge-success' :
                          lead.ai_score >= 5 ? 'badge-warning' :
                          'badge-danger'
                        }`}>
                          {lead.status?.name || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* High-Score Leads */}
          {highScoreLeads.length > 0 && (
            <div className="card">
              <div className="flex items-center mb-6">
                <Star className="h-6 w-6 text-yellow-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">High-Scoring Leads (Score ≥ 5)</h3>
              </div>
              <div className="space-y-4">
                {highScoreLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Star className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{lead.name}</p>
                        <p className="text-sm text-gray-600">{lead.company_name || 'No company'}</p>
                        <p className="text-xs text-gray-500 mt-1">{lead.ai_reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{lead.ai_score}/10</p>
                        <p className="text-xs text-gray-500">AI Score</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{lead.pipeline?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">Pipeline</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
