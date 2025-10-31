'use client'

import { useState, useEffect } from 'react'
import { 
  ArrowRight, 
  Users, 
  Target, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  Star
} from 'lucide-react'
import { kommoClient } from '@/lib/kommo-client'
import { Lead, Pipeline } from '@/lib/kommo-client'

interface ScoredLead extends Lead {
  ai_score: number
  ai_reason: string
}

export default function LeadMover() {
  const [leads, setLeads] = useState<ScoredLead[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentLead, setCurrentLead] = useState('')
  const [numLeads, setNumLeads] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  
  // Selection states
  const [selectedPipeline, setSelectedPipeline] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null)
  const [selectedUser, setSelectedUser] = useState<number | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  const [pipelineStatuses, setPipelineStatuses] = useState<Array<{id: number, name: string}>>([])
  const [showAdultFilter, setShowAdultFilter] = useState(false)
  const [showNonAdultFilter, setShowNonAdultFilter] = useState(false)
  const [showClosedFilter, setShowClosedFilter] = useState(false)
  const [filterPipeline, setFilterPipeline] = useState<number | null>(null)
  const [minScore, setMinScore] = useState<number | null>(null)
  const [maxScore, setMaxScore] = useState<number | null>(null)
  const [cycleUsers, setCycleUsers] = useState(false)
  const [userCycleIndex, setUserCycleIndex] = useState(0)

  useEffect(() => {
    const loadScoredLeads = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Try to get scored leads from localStorage first
        const storedScoredLeads = localStorage.getItem('scoredLeads')
        let scoredLeads: ScoredLead[] = []
        
        if (storedScoredLeads) {
          try {
            scoredLeads = JSON.parse(storedScoredLeads)
            console.log(`📊 Loaded ${scoredLeads.length} scored leads from localStorage`)
          } catch (parseError) {
            console.error('Error parsing stored scored leads:', parseError)
          }
        }
        
        // If no stored leads, show empty state
        if (scoredLeads.length === 0) {
          setError('No scanned leads found. Please score leads first using the "Lead Scoring" page.')
          setLoading(false)
          return
        }
        
        // Fetch pipelines and users (still needed for the copy functionality)
        const [pipelinesData, usersData] = await Promise.all([
          kommoClient.getPipelines(),
          kommoClient.getUsers()
        ])
        
        console.log('Loaded data:', {
          scoredLeads: scoredLeads.length,
          pipelines: pipelinesData.length,
          users: usersData.length
        })
        
        setLeads(scoredLeads)
        setPipelines(pipelinesData)
        setUsers(usersData)
        
        setDataLoaded(true)
        setSuccessMessage(`✅ Successfully loaded ${scoredLeads.length} scanned leads`)
        console.log(`✅ Successfully loaded ${scoredLeads.length} scanned leads`)
        
      } catch (err) {
        setError('Failed to load scored leads. Please score leads first using the "Lead Scoring" page.')
        console.error('Error loading scored leads:', err)
      } finally {
        setLoading(false)
      }
    }

    loadScoredLeads()
  }, [])

  // Helper function to get next user in sequence
  const getNextUser = (currentIndex: number): number | null => {
    // Target users based on actual names from the API
    const targetUsers = users.filter(user => {
      const name = user.name.toLowerCase().trim()
      return name === 'algorithmics rabat' || 
             name === 'hayat' || 
             name === 'fatimazohraelhouari' ||
             name.includes('algorithmics') ||
             name.includes('hayat') ||
             name.includes('fatima')
    })
    
    console.log('Available users:', users.map(u => ({ id: u.id, name: u.name })))
    console.log('Target users found:', targetUsers.map(u => ({ id: u.id, name: u.name })))
    
    if (targetUsers.length === 0) {
      console.error('No target users found matching Algorithmics Rabat, Hayat, or Fatimazohraelhouari')
      console.error('Available user names:', users.map(u => u.name))
      return null
    }
    
    // Get the next user in sequence and cycle back to 0 when reaching the end
    const selectedUser = targetUsers[currentIndex % targetUsers.length]
    console.log(`Sequential selection: cycle index ${currentIndex}, user: ${selectedUser.name} (ID: ${selectedUser.id})`)
    
    return selectedUser.id
  }

  const handleCopyLeads = async () => {
    if (!selectedPipeline || !selectedStatus || selectedLeads.length === 0) {
      setError('Please select pipeline, status, and leads to copy')
      return
    }

    // If not cycling, check if user is selected
    if (!cycleUsers && !selectedUser) {
      setError('Please select a user or enable user cycling')
      return
    }

    setCopying(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      let copiedCount = 0
      const leadsToCopy = selectedLeads.slice(0, numLeads)
      let currentCycleIndex = userCycleIndex // Start with current cycle index
      
      console.log(`🔄 Starting move process for ${leadsToCopy.length} selected leads`)
      console.log(`📋 Selected lead IDs:`, leadsToCopy)
      console.log(`📊 Available leads:`, leads.map(l => ({ id: l.id, name: l.name, score: l.ai_score })))
      console.log(`🔄 Starting cycle index: ${currentCycleIndex}`)
      
      for (let i = 0; i < leadsToCopy.length; i++) {
        const leadId = leadsToCopy[i]
        const lead = leads.find(l => l.id === leadId)
        setCurrentLead(lead?.name || 'Unknown')
        setProgress(((i + 1) / leadsToCopy.length) * 100)
        
        console.log(`🔄 Processing lead ${i + 1}/${leadsToCopy.length}: ID ${leadId}, Name: ${lead?.name}, Score: ${lead?.ai_score}`)
        
        if (lead) {
          // Get the user ID - either selected user or next user in sequence
          const userId = cycleUsers ? getNextUser(currentCycleIndex) : selectedUser
          
          console.log(`Lead ${lead.name}: Using user ID ${userId} (cycling: ${cycleUsers}, cycle index: ${currentCycleIndex})`)
          
          if (!userId) {
            console.error('No user ID available for lead assignment')
            continue
          }
          
          // Increment cycle index for next lead
          if (cycleUsers) {
            currentCycleIndex++
          }
          
          const success = await kommoClient.moveLeadToPipeline(
            leadId, 
            selectedPipeline, 
            selectedStatus
          )
          
          // If move was successful, update the responsible user and add score tags
          if (success) {
            const updateData: any = {}
            
            // Add user assignment if we have a user
            if (userId) {
              updateData.responsible_user_id = userId
            }
            
            // Add score tags - try both methods
            const score = lead.ai_score || 5
            const scoreTag = `AI Score: ${score}/10`
            
            // Method 1: Try adding as tags array
            updateData.tags = [scoreTag]
            
            const userUpdateSuccess = await kommoClient.updateLead(leadId, updateData)
            console.log(`👤 User assignment and score tags for lead ${lead.name}: ${userUpdateSuccess ? 'SUCCESS' : 'FAILED'}`)
            
            // Method 2: Use addTagToLead method for the AI Score tag only
            const tagSuccess = await kommoClient.addTagToLead(leadId, scoreTag)
            console.log(`🏷️ AI Score tag addition for lead ${lead.name}: ${tagSuccess ? 'SUCCESS' : 'FAILED'}`)
          }
          
          console.log(`📋 Move result for lead ${lead.name}: ${success ? 'SUCCESS' : 'FAILED'}`)
          
          if (success) {
            copiedCount++
          }
        } else {
          console.error(`❌ Lead with ID ${leadId} not found in available leads`)
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      // Update the global cycle index for next time
      if (cycleUsers) {
        setUserCycleIndex(currentCycleIndex)
        console.log(`🔄 Updated global cycle index to: ${currentCycleIndex}`)
      }
      
      const pipelineName = pipelines.find(p => p.id === selectedPipeline)?.name
      const userInfo = cycleUsers 
        ? 'with sequential user assignment (Algorithmics Rabat → Hayat → Fatimazohraelhouari → repeat)' 
        : `assigned to ${users.find(u => u.id === selectedUser)?.name}`
      
      setSuccessMessage(`✅ Successfully moved ${copiedCount} leads to ${pipelineName} ${userInfo}!`)
      setCopying(false)
    } catch (err) {
      setError('Failed to move leads')
      setCopying(false)
      console.error('Error moving leads:', err)
    }
  }

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  const selectAllLeads = () => {
    const filteredLeads = getFilteredLeads()
    const availableLeads = filteredLeads.slice(0, numLeads === 999999 ? undefined : numLeads).map(lead => lead.id)
    setSelectedLeads(availableLeads)
  }

  const clearSelection = () => {
    setSelectedLeads([])
  }

  const selectedPipelineData = pipelines.find(p => p.id === selectedPipeline)
  const selectedStatusData = pipelineStatuses.find(s => s.id === selectedStatus)
  const selectedUserData = users.find(u => u.id === selectedUser)

  // Function to check if lead has adult field enabled
  const hasAdultField = (lead: ScoredLead): boolean => {
    const hasAdult = lead.custom_fields_values?.some(field => 
      (field.field_id === 612777 || field.field_name === 'Adult') && 
      field.values?.some(value => 
        value.value === 'Yes' || 
        value.value === '1' || 
        value.value === 'true' ||
        String(value.value) === 'true' ||
        String(value.value) === '1'
      )
    ) || false
    
    // Debug logging
    if (lead.custom_fields_values) {
      console.log(`🔍 All custom fields for lead ${lead.name}:`, lead.custom_fields_values.map(f => ({
        fieldId: f.field_id,
        fieldName: f.field_name,
        values: f.values
      })))
      
      const adultField = lead.custom_fields_values.find(field => field.field_id === 612777)
      if (adultField) {
        console.log(`🔍 Adult field for lead ${lead.name}:`, {
          fieldId: adultField.field_id,
          values: adultField.values,
          hasAdult: hasAdult
        })
        
        // Log each value to see what we're actually getting
        adultField.values.forEach((value, index) => {
          console.log(`🔍 Adult field value ${index}:`, {
            value: value.value,
            type: typeof value.value,
            raw: JSON.stringify(value)
          })
        })
      } else {
        console.log(`🔍 No adult field (612777) found for lead ${lead.name}`)
      }
    } else {
      console.log(`🔍 No custom fields for lead ${lead.name}`)
    }
    
    return hasAdult
  }

  // Function to filter leads based on adult field filter, pipeline filter, and score range
  const getFilteredLeads = (): ScoredLead[] => {
    let filteredLeads = leads
    
    // Filter by pipeline if selected - show only scored leads from that pipeline
    if (filterPipeline) {
      filteredLeads = leads.filter(lead => lead.pipeline_id === filterPipeline)
    }
    
    // Filter by score range if specified
    if (minScore !== null || maxScore !== null) {
      filteredLeads = filteredLeads.filter(lead => {
        const score = lead.ai_score || 0
        const min = minScore !== null ? minScore : 0
        const max = maxScore !== null ? maxScore : 10
        return score >= min && score <= max
      })
    }
    
    // Filter by adult field if enabled
    if (showAdultFilter) {
      console.log(`🔍 Adult filter enabled. Total leads before filter: ${filteredLeads.length}`)
      const adultLeads = filteredLeads.filter(lead => hasAdultField(lead))
      console.log(`🔍 Adult leads found: ${adultLeads.length}`)
      filteredLeads = adultLeads
    }
    
    // Filter by non-adult field if enabled
    if (showNonAdultFilter) {
      console.log(`🔍 Non-adult filter enabled. Total leads before filter: ${filteredLeads.length}`)
      const nonAdultLeads = filteredLeads.filter(lead => !hasAdultField(lead))
      console.log(`🔍 Non-adult leads found: ${nonAdultLeads.length}`)
      filteredLeads = nonAdultLeads
    }
    
    // Filter by closed leads if enabled
    if (showClosedFilter) {
      console.log(`🔍 Closed filter enabled. Total leads before filter: ${filteredLeads.length}`)
      const closedLeads = filteredLeads.filter(lead => lead.closed_at !== null && lead.closed_at !== undefined)
      console.log(`🔍 Closed leads found: ${closedLeads.length}`)
      filteredLeads = closedLeads
    }
    
    return filteredLeads
  }


  // Function to fetch statuses when pipeline is selected
  const handlePipelineChange = async (pipelineId: number) => {
    setSelectedPipeline(pipelineId)
    setSelectedStatus(null) // Reset status selection
    
    if (pipelineId) {
      try {
        console.log(`🔄 Fetching statuses for pipeline ${pipelineId}`)
        const statuses = await kommoClient.getPipelineStatuses(pipelineId)
        setPipelineStatuses(statuses)
        console.log(`✅ Loaded ${statuses.length} statuses for pipeline ${pipelineId}`)
      } catch (error) {
        console.error('Error fetching pipeline statuses:', error)
        setPipelineStatuses([])
      }
    } else {
      setPipelineStatuses([])
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="card">
        <div className="flex items-center text-red-600">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <ArrowRight className="h-6 w-6 mr-2 text-primary-600" />
          Move Scanned Leads
        </h2>
        <p className="text-gray-600 mb-6">
          Move leads that have been scanned/scored to a specific pipeline stage and assign a responsible user. This updates the existing leads.
        </p>

        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Number of leads */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Leads
            </label>
            <select
              value={numLeads}
              onChange={(e) => setNumLeads(parseInt(e.target.value))}
              className="input-field"
            >
              {[1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50, 100, 200, 500, 1000].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
              <option value={999999}>All</option>
            </select>
          </div>

          {/* Pipeline selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Pipeline
            </label>
            <select
              value={selectedPipeline || ''}
              onChange={(e) => {
                const pipelineId = parseInt(e.target.value)
                handlePipelineChange(pipelineId)
              }}
              className="input-field"
            >
              <option value="">Select Pipeline</option>
              {pipelines.map(pipeline => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Status
            </label>
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(parseInt(e.target.value))}
              className="input-field"
              disabled={!selectedPipeline}
            >
              <option value="">Select Status</option>
              {pipelineStatuses.length > 0 ? (
                pipelineStatuses.map(status => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  {selectedPipeline ? 'Loading statuses...' : 'No statuses available'}
                </option>
              )}
            </select>
          </div>

          {/* User selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Responsible User
            </label>
            <div className="space-y-2">
              <select
                value={selectedUser || ''}
                onChange={(e) => setSelectedUser(parseInt(e.target.value))}
                className="input-field"
                disabled={cycleUsers}
              >
                <option value="">Select User</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              
              {/* User cycling toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="cycleUsers"
                  checked={cycleUsers}
                  onChange={(e) => {
                    setCycleUsers(e.target.checked)
                    if (e.target.checked) {
                      setSelectedUser(null) // Clear selected user when cycling
                    }
                  }}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="cycleUsers" className="text-sm text-gray-700">
                  Cycle through Algorithmics Rabat → Hayat → Fatimazohraelhouari → repeat
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={selectAllLeads}
            className="btn-secondary flex items-center space-x-2"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Select All ({Math.min(numLeads === 999999 ? getFilteredLeads().length : numLeads, getFilteredLeads().length)})</span>
          </button>
          
          <button
            onClick={clearSelection}
            className="btn-secondary"
          >
            Clear Selection
          </button>
          
          {/* Pipeline Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Filter by Pipeline:</label>
            <select
              value={filterPipeline || ''}
              onChange={(e) => setFilterPipeline(Number(e.target.value) || null)}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">All Pipelines</option>
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Score Range Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Score Range:</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                min="0"
                max="10"
                placeholder="Min"
                value={minScore || ''}
                onChange={(e) => setMinScore(e.target.value ? Number(e.target.value) : null)}
                className="w-16 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <span className="text-gray-500">-</span>
              <input
                type="number"
                min="0"
                max="10"
                placeholder="Max"
                value={maxScore || ''}
                onChange={(e) => setMaxScore(e.target.value ? Number(e.target.value) : null)}
                className="w-16 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <button
                onClick={() => {
                  setMinScore(null)
                  setMaxScore(null)
                }}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                title="Clear score filter"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  setMinScore(6)
                  setMaxScore(10)
                }}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                title="High scores (6-10)"
              >
                6+
              </button>
              <button
                onClick={() => {
                  setMinScore(8)
                  setMaxScore(10)
                }}
                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                title="Very high scores (8-10)"
              >
                8+
              </button>
            </div>
          </div>
          
          <button
            onClick={() => {
              setShowAdultFilter(!showAdultFilter)
              if (showNonAdultFilter) setShowNonAdultFilter(false) // Disable non-adult if adult is selected
            }}
            className={`btn-secondary flex items-center space-x-2 ${
              showAdultFilter ? 'bg-green-100 text-green-700 border-green-300' : ''
            }`}
          >
            <Users className="h-4 w-4" />
            <span>
              {showAdultFilter ? 'Show All Leads' : 'Show Adult Leads Only'}
            </span>
          </button>
          
          <button
            onClick={() => {
              setShowNonAdultFilter(!showNonAdultFilter)
              if (showAdultFilter) setShowAdultFilter(false) // Disable adult if non-adult is selected
            }}
            className={`btn-secondary flex items-center space-x-2 ${
              showNonAdultFilter ? 'bg-blue-100 text-blue-700 border-blue-300' : ''
            }`}
          >
            <Users className="h-4 w-4" />
            <span>
              {showNonAdultFilter ? 'Show All Leads' : 'Show Non-Adult Leads Only'}
            </span>
          </button>
          
          <button
            onClick={() => {
              setShowClosedFilter(!showClosedFilter)
            }}
            className={`btn-secondary flex items-center space-x-2 ${
              showClosedFilter ? 'bg-red-100 text-red-700 border-red-300' : ''
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            <span>
              {showClosedFilter ? 'Show All Leads' : 'Show Closed Leads Only'}
            </span>
          </button>
          
          <button
            onClick={handleCopyLeads}
            disabled={copying || selectedLeads.length === 0}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copying ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Moving...</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                <span>Move Selected ({selectedLeads.length})</span>
              </>
            )}
          </button>
        </div>

        {/* Progress */}
        {copying && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Moving leads...</span>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-1">Processing: {currentLead}</p>
          </div>
        )}

        {/* Success/Error messages */}
        {error && (
          <div className="card">
            <div className="flex items-center text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {successMessage && (
          <div className="card">
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>{successMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Scored Leads List */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Star className="h-5 w-5 mr-2 text-yellow-500" />
            {showAdultFilter ? 'Adult Scored Leads' : showNonAdultFilter ? 'Non-Adult Scored Leads' : showClosedFilter ? 'Closed Scored Leads' : 'All Scored Leads'}
          </h3>
          <div className="text-sm text-gray-600">
            Showing {getFilteredLeads().length} of {leads.length} leads
            {filterPipeline && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                Pipeline Filter Active
              </span>
            )}
            {(minScore !== null || maxScore !== null) && (
              <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                Score Filter: {minScore !== null ? minScore : 0}-{maxScore !== null ? maxScore : 10}
              </span>
            )}
            {showAdultFilter && (
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                Adult Filter Active
              </span>
            )}
            {showNonAdultFilter && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                Non-Adult Filter Active
              </span>
            )}
            {showClosedFilter && (
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                Closed Filter Active
              </span>
            )}
          </div>
        </div>
        
        <div className="table-container">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header w-12">
                  <input
                    type="checkbox"
                    checked={selectedLeads.length === Math.min(numLeads === 999999 ? getFilteredLeads().length : numLeads, getFilteredLeads().length) && getFilteredLeads().slice(0, numLeads === 999999 ? undefined : numLeads).length > 0}
                    onChange={(e) => e.target.checked ? selectAllLeads() : clearSelection()}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="table-header">Name</th>
                <th className="table-header">Company</th>
                <th className="table-header">AI Score</th>
                <th className="table-header">Reason</th>
                <th className="table-header">Current Pipeline</th>
                <th className="table-header">Current Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredLeads().slice(0, numLeads === 999999 ? undefined : numLeads).map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
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
                      {hasAdultField(lead) && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 mr-2">
                          ADULT
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
              ))}
            </tbody>
          </table>
        </div>
        
        {getFilteredLeads().length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-4">
              <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {showAdultFilter ? 'No Adult Leads Found' : showNonAdultFilter ? 'No Non-Adult Leads Found' : showClosedFilter ? 'No Closed Leads Found' : 'No Scanned Leads Found'}
              </h3>
              <p className="text-gray-600 mb-4">
                {showAdultFilter 
                  ? 'No leads with adult field enabled found. Try turning off the adult filter or score more leads first.'
                  : showNonAdultFilter
                  ? 'No leads without adult field enabled found. Try turning off the non-adult filter or score more leads first.'
                  : showClosedFilter
                  ? 'No closed leads found. Try turning off the closed filter or check if you have any closed scored leads.'
                  : 'No leads that have been scanned/scored found. You need to score leads first using the "Lead Scoring" page.'
                }
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                <h4 className="font-medium text-blue-900 mb-2">To get started:</h4>
                <ol className="list-decimal list-inside text-blue-800 space-y-1">
                  <li>Go to the "Lead Scoring" page</li>
                  <li>Select the number of leads you want to score</li>
                  <li>Click "Score Leads" to run AI scoring</li>
                  <li>Come back to this page to copy scanned leads</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
