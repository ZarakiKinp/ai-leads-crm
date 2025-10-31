import axios from 'axios'
import { getDemoData } from './demo-data'

// Use Next.js API routes to avoid CORS issues
const baseURL = '/api/kommo'

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Demo mode flag - force reset to false
let isDemoMode = false

// Option to disable status fetching to avoid rate limits
let skipStatusFetching = false

// Function to reset demo mode
export const resetDemoMode = () => {
  isDemoMode = false
  console.log('🔄 Demo mode reset to false')
}

// Function to toggle status fetching
export const setSkipStatusFetching = (skip: boolean) => {
  skipStatusFetching = skip
  console.log(`🔄 Status fetching ${skip ? 'disabled' : 'enabled'}`)
}

// Helper function to check if a lead is closed
export const isLeadClosed = (lead: Lead): boolean => {
  return lead.closed_at !== null && lead.closed_at !== undefined
}

export interface Lead {
  id: number
  name: string
  company_name?: string
  position?: string
  phone?: Array<{ value: string }>
  email?: Array<{ value: string }>
  custom_fields_values?: Array<{
    field_id?: number
    field_name: string
    values: Array<{ value: string }>
  }>
  pipeline?: {
    id: number
    name: string
  }
  status?: {
    id: number
    name: string
  }
  price?: number
  created_at?: number
  updated_at?: number
  closed_at?: number | null
  responsible_user_id?: number
  _embedded?: {
    tags?: Array<{ name: string }>
  }
  ai_score?: number
  ai_reason?: string
}

export interface Pipeline {
  id: number
  name: string
  statuses?: Array<{
    id: number
    name: string
  }>
}

export interface ScoredLead extends Lead {
  ai_score: number
  ai_reason: string
}

export class KommoClient {
  async getPipelineStatuses(pipelineId: number): Promise<Array<{id: number, name: string}>> {
    try {
      console.log(`🔄 Fetching statuses for pipeline ${pipelineId}`)
      const response = await api.get(`/leads/pipelines/${pipelineId}`)
      const statuses = response.data._embedded?.statuses || []
      console.log(`✅ Found ${statuses.length} statuses for pipeline ${pipelineId}`)
      return statuses.map((status: any) => ({
        id: status.id,
        name: status.name
      }))
    } catch (error) {
      console.error(`Error fetching statuses for pipeline ${pipelineId}:`, error)
      return []
    }
  }

  async getPipelines(): Promise<Pipeline[]> {
    try {
      const response = await api.get('/leads/pipelines')
      const pipelines = response.data._embedded?.pipelines || []
      
      // If we have many pipelines or status fetching is disabled, skip status fetching to avoid rate limits
      if (pipelines.length > 10 || skipStatusFetching) {
        console.log(`⚠️ Skipping status fetching (${pipelines.length} pipelines, skipStatusFetching: ${skipStatusFetching})`)
        return pipelines.map((pipeline: any) => ({
          ...pipeline,
          statuses: []
        }))
      }
      
      // Fetch statuses for each pipeline with rate limiting
      const pipelinesWithStatuses = []
      for (let i = 0; i < pipelines.length; i++) {
        const pipeline = pipelines[i]
        try {
          // Add delay between requests to avoid rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 300)) // 300ms delay
          }
          
          const statusResponse = await api.get(`/leads/pipelines/${pipeline.id}`)
          const statuses = statusResponse.data._embedded?.statuses || []
          pipelinesWithStatuses.push({
            ...pipeline,
            statuses: statuses.map((status: any) => ({
              id: status.id,
              name: status.name
            }))
          })
        } catch (statusError: any) {
          console.error(`Error fetching statuses for pipeline ${pipeline.id}:`, statusError)
          
          // If it's a rate limit error, add longer delay and retry once
          if (statusError.response?.status === 429) {
            console.log(`⏳ Rate limited, waiting 2 seconds before continuing...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            try {
              const retryResponse = await api.get(`/leads/pipelines/${pipeline.id}`)
              const statuses = retryResponse.data._embedded?.statuses || []
              pipelinesWithStatuses.push({
                ...pipeline,
                statuses: statuses.map((status: any) => ({
                  id: status.id,
                  name: status.name
                }))
              })
            } catch (retryError) {
              console.error(`Retry failed for pipeline ${pipeline.id}:`, retryError)
              pipelinesWithStatuses.push({
                ...pipeline,
                statuses: []
              })
            }
          } else {
            pipelinesWithStatuses.push({
              ...pipeline,
              statuses: []
            })
          }
        }
      }
      
      return pipelinesWithStatuses
    } catch (error) {
      console.error('Error fetching pipelines:', error)
      console.log('Switching to demo mode...')
      isDemoMode = true
      const demoData = getDemoData()
      return demoData.pipelines
    }
  }

  async getLeadsFromPipeline(pipelineId: number, limit: number = 250): Promise<Lead[]> {
    if (isDemoMode) {
      const demoData = getDemoData()
      return demoData.leads.filter(lead => lead.pipeline?.id === pipelineId)
    }
    
    try {
      const allLeads: Lead[] = []
      let page = 1
      
      while (true) {
        const response = await api.get('/leads', {
          params: {
            'filter[pipeline_id]': pipelineId,
            limit,
            page,
            with: 'contacts,companies'
          }
        })
        
        const leads = response.data._embedded?.leads || []
        if (leads.length === 0) break
        
        allLeads.push(...leads)
        page++
        
        if (leads.length < limit) break
      }
      
      return allLeads
    } catch (error) {
      console.error('Error fetching leads from pipeline:', error)
      throw new Error('Failed to fetch leads from pipeline')
    }
  }

  async getAllLeads(): Promise<Lead[]> {
    if (isDemoMode) {
      const demoData = getDemoData()
      return demoData.leads
    }
    
    try {
      const pipelines = await this.getPipelines()
      const allLeads: Lead[] = []
      const failedPipelines: number[] = []
      
      for (const pipeline of pipelines) {
        try {
          const leads = await this.getLeadsFromPipeline(pipeline.id)
          allLeads.push(...leads)
          console.log(`✅ Fetched ${leads.length} leads from pipeline ${pipeline.name}`)
        } catch (error) {
          console.error(`❌ Failed to fetch leads from pipeline ${pipeline.name} (${pipeline.id}):`, error)
          failedPipelines.push(pipeline.id)
          // Continue with other pipelines instead of failing completely
        }
      }
      
      if (failedPipelines.length > 0) {
        console.log(`⚠️ Failed to fetch leads from ${failedPipelines.length} pipelines, but continuing with ${allLeads.length} leads from successful pipelines`)
      }
      
      return allLeads
    } catch (error) {
      console.error('Error fetching all leads:', error)
      throw new Error('Failed to fetch all leads')
    }
  }

  async updateLead(leadId: number, data: Partial<Lead>): Promise<Lead> {
    try {
      const response = await api.patch(`/leads/${leadId}`, data)
      return response.data
    } catch (error) {
      console.error('Error updating lead:', error)
      throw new Error('Failed to update lead')
    }
  }

  async addTagToLead(leadId: number, tagName: string): Promise<boolean> {
    try {
      console.log(`🔄 Adding tag "${tagName}" to lead ${leadId}`)
      
      // First get current lead data to get existing tags
      const leadResponse = await api.get(`/leads/${leadId}`)
      const currentLead = leadResponse.data
      
      console.log('Current lead data:', currentLead)
      
      // Get current tags
      const currentTags = currentLead._embedded?.tags || []
      const currentTagNames = currentTags.map((tag: any) => tag.name)
      
      console.log('Current tags:', currentTagNames)
      
      // Add new tag if not already present
      if (!currentTagNames.includes(tagName)) {
        currentTagNames.push(tagName)
        console.log('Updated tag list:', currentTagNames)
        
        // Update the lead with new tags using PATCH
        const requestBody = [
          {
            "_embedded": {
              "tags": currentTagNames.map(name => ({ name }))
            },
            "id": leadId
          }
        ]
        
        console.log('PATCH request body:', JSON.stringify(requestBody, null, 2))
        
        const response = await api.patch('/leads', requestBody)
        
        console.log('Tag addition response:', response.data)
        console.log('✅ Tag added successfully with color:', requestBody[0]._embedded.tags.find(t => t.name === tagName)?.color)
        return true
      } else {
        console.log(`Tag "${tagName}" already exists for lead ${leadId}`)
        return true
      }
    } catch (error) {
      console.error('Error adding tag to lead:', error)
      console.error('Error details:', {
        leadId,
        tagName,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      })
      
      // Log the full error response for debugging
      if (error.response?.data) {
        console.error('Full error response:', JSON.stringify(error.response.data, null, 2))
      }
      
      return false
    }
  }

  async moveLeadToPipeline(leadId: number, pipelineId: number, statusId: number): Promise<boolean> {
    try {
      await this.updateLead(leadId, {
        pipeline_id: pipelineId,
        status_id: statusId
      })
      return true
    } catch (error) {
      console.error('Error moving lead to pipeline:', error)
      return false
    }
  }

  async copyLead(leadId: number, pipelineId: number, statusId: number, responsibleUserId: number, score: number): Promise<boolean> {
    try {
      console.log(`🔄 Copying lead ${leadId} with score ${score} to pipeline ${pipelineId}, status ${statusId}`)
      
      // Get the original lead data
      const originalLead = await this.getLeadById(leadId)
      console.log(`📋 Original lead data:`, { 
        name: originalLead.name, 
        score: score,
        pipeline_id: originalLead.pipeline_id,
        status_id: originalLead.status_id,
        responsible_user_id: originalLead.responsible_user_id,
        price: originalLead.price,
        phone: originalLead.phone,
        email: originalLead.email,
        custom_fields_values: originalLead.custom_fields_values
      })
      
      // Create new lead data with same information but new pipeline/status
      const newLeadData = {
        name: originalLead.name || 'Copied Lead',
        pipeline_id: pipelineId,
        status_id: statusId,
        responsible_user_id: responsibleUserId,
        price: originalLead.price || 0,
        // Copy contact information if available
        ...(originalLead.phone && { phone: originalLead.phone }),
        ...(originalLead.email && { email: originalLead.email }),
        // Copy custom fields if available
        ...(originalLead.custom_fields_values && { custom_fields_values: originalLead.custom_fields_values })
      }
      
      // Validate required fields
      if (!newLeadData.name) {
        console.error('❌ Lead name is required')
        return false
      }
      if (!newLeadData.pipeline_id) {
        console.error('❌ Pipeline ID is required')
        return false
      }
      if (!newLeadData.status_id) {
        console.error('❌ Status ID is required')
        return false
      }
      if (!newLeadData.responsible_user_id) {
        console.error('❌ Responsible user ID is required')
        return false
      }
      
      console.log(`📋 Creating lead with data:`, JSON.stringify(newLeadData, null, 2))
      
      // Add score tag separately after creating the lead
      // Kommo API expects lead data to be wrapped in an array
      const leadResponse = await api.post('/leads', [newLeadData])
      
      console.log(`📋 Lead creation response:`, leadResponse.data)
      
      // Handle array response from Kommo API
      const createdLead = leadResponse.data && leadResponse.data._embedded && leadResponse.data._embedded.leads && leadResponse.data._embedded.leads[0]
      
      if (createdLead && createdLead.id) {
        console.log(`✅ Successfully created lead ${originalLead.name} with ID ${createdLead.id}`)
        
        // Now add the score tag to the created lead
        try {
          const tagData = [{
            id: createdLead.id,
            _embedded: {
              tags: [
                { name: `Score: ${score}` }
              ]
            }
          }]
          
          console.log(`🏷️ Adding score tag to lead ${createdLead.id}`)
          await api.patch('/leads', tagData)
          console.log(`✅ Successfully added score tag to lead ${createdLead.id}`)
        } catch (tagError) {
          console.error('Error adding score tag:', tagError)
          // Don't fail the whole operation if tagging fails
        }
        
        return true
      }
      
      console.log(`❌ Failed to create lead - no ID in response`)
      console.log(`📋 Full response:`, JSON.stringify(leadResponse.data, null, 2))
      return false
    } catch (error) {
      console.error('Error copying lead:', error)
      
      // Log detailed error information
      if (error.response) {
        console.error('❌ API Error Response:', error.response.data)
        console.error('❌ API Error Status:', error.response.status)
        console.error('❌ API Error Headers:', error.response.headers)
        
        // Try to parse validation errors for better debugging
        try {
          const errorData = error.response.data
          if (errorData && errorData.error && errorData.error.includes('validation-errors')) {
            console.error('❌ Validation Errors Detected - This might be due to:')
            console.error('   - Invalid enum values in custom fields')
            console.error('   - Missing required fields')
            console.error('   - Invalid field types')
            console.error('   - Custom field values not matching the field configuration')
            
            // Try fallback: copy without custom fields
            console.log('🔄 Attempting fallback: copying lead without custom fields...')
            try {
              // Get fresh lead data for fallback
              const fallbackLeadData = await this.getLeadById(leadId)
              const fallbackData = {
                name: fallbackLeadData.name || 'Copied Lead',
                pipeline_id: pipelineId,
                status_id: statusId,
                responsible_user_id: responsibleUserId,
                price: fallbackLeadData.price || 0,
                // Copy contact information if available
                ...(fallbackLeadData.phone && { phone: fallbackLeadData.phone }),
                ...(fallbackLeadData.email && { email: fallbackLeadData.email })
                // Intentionally omitting custom_fields_values
              }
              
              console.log(`📋 Fallback lead data:`, JSON.stringify(fallbackData, null, 2))
              const fallbackResponse = await api.post('/leads', [fallbackData])
              
              const fallbackLead = fallbackResponse.data && fallbackResponse.data._embedded && fallbackResponse.data._embedded.leads && fallbackResponse.data._embedded.leads[0]
              
              if (fallbackLead && fallbackLead.id) {
                console.log(`✅ Fallback successful: Created lead ${fallbackLeadData.name} with ID ${fallbackLead.id} (without custom fields)`)
                
                // Add score tag
                try {
                  const tagData = [{
                    id: fallbackLead.id,
                    _embedded: {
                      tags: [
                        { name: `Score: ${score}` }
                      ]
                    }
                  }]
                  
                  await api.patch('/leads', tagData)
                  console.log(`✅ Successfully added score tag to fallback lead ${fallbackLead.id}`)
                } catch (tagError) {
                  console.error('Error adding score tag to fallback lead:', tagError)
                }
                
                return true
              }
            } catch (fallbackError) {
              console.error('❌ Fallback also failed:', fallbackError)
            }
          }
        } catch (parseError) {
          console.error('❌ Could not parse validation errors:', parseError)
        }
      } else if (error.request) {
        console.error('❌ Request Error:', error.request)
      } else {
        console.error('❌ Error Message:', error.message)
      }
      
      return false
    }
  }

  async getUsers(): Promise<any[]> {
    if (isDemoMode) {
      return [
        { id: 1, name: 'John Smith' },
        { id: 2, name: 'Sarah Johnson' },
        { id: 3, name: 'Mike Wilson' }
      ]
    }
    
    try {
      const response = await api.get('/users')
      return response.data._embedded?.users || []
    } catch (error) {
      console.error('Error fetching users:', error)
      throw new Error('Failed to fetch users')
    }
  }


  async getLeadMessages(leadId: number): Promise<any[]> {
    if (isDemoMode) {
      // Return demo messages
      return [
        {
          id: 1,
          text: "Hi, I'm interested in your product. Can you tell me more about pricing?",
          created_at: Date.now() / 1000 - 3600,
          responsible_user_id: 1
        },
        {
          id: 2,
          text: "We have a budget of $50k for this project. When can we schedule a demo?",
          created_at: Date.now() / 1000 - 1800,
          responsible_user_id: 1
        }
      ]
    }
    
    try {
      console.log(`🔄 Fetching messages for lead ${leadId}`)
      
      // Step 1: Get the lead to find associated contacts
      const leadResponse = await api.get(`/leads/${leadId}`, {
        params: { with: 'contacts' }
      })
      const lead = leadResponse.data
      const contacts = lead._embedded?.contacts || []
      
      console.log(`📋 Lead ${leadId} has ${contacts.length} contact(s)`)
      
      if (contacts.length === 0) {
        console.log(`⚠️ No contacts found for lead ${leadId}`)
        return []
      }
      
      const allMessages: any[] = []
      
      // Step 2: For each contact, get their chats
      for (const contact of contacts) {
        try {
          console.log(`🔄 Fetching chats for contact ${contact.id}`)
          const chatsResponse = await api.get(`/contacts/${contact.id}/chats`)
          const chats = chatsResponse.data._embedded?.chats || []
          
          console.log(`✅ Found ${chats.length} chat(s) for contact ${contact.id}`)
          
          // Step 3: For each chat, get the conversation messages
          for (const chat of chats) {
            try {
              console.log(`🔄 Fetching conversation ${chat.id}`)
              const conversationResponse = await api.get(`/talks/${chat.id}`)
              const conversation = conversationResponse.data
              
              // Get messages from conversation
              const messages = conversation._embedded?.messages || []
              console.log(`✅ Found ${messages.length} message(s) in conversation ${chat.id}`)
              
              // Add messages to our collection
              messages.forEach((msg: any) => {
                allMessages.push({
                  id: msg.id,
                  text: msg.text || msg.message || 'Message (no text)',
                  type: msg.type || 'message',
                  created_at: msg.created_at,
                  author_id: msg.author?.id,
                  is_incoming: msg.author?.id !== lead.responsible_user_id
                })
              })
            } catch (convError: any) {
              console.log(`❌ Failed to fetch conversation ${chat.id}:`, convError.response?.status)
            }
          }
        } catch (chatError: any) {
          console.log(`❌ Failed to fetch chats for contact ${contact.id}:`, chatError.response?.status)
        }
      }
      
      console.log(`✅ Total messages fetched for lead ${leadId}: ${allMessages.length}`)
      return allMessages
      
    } catch (error: any) {
      console.error(`Error fetching messages for lead ${leadId}:`, error)
      console.log(`⚠️ Fallback: Using event types as communication activity indicators`)
      
      // Fallback: Get events and use them as communication activity indicators
      try {
        const eventsResponse = await api.get(`/events?filter[lead_id]=${leadId}`)
        const events = eventsResponse.data._embedded?.events || []
        
        const messageEvents = events.filter((event: any) => 
          event.type === 'incoming_chat_message' ||
          event.type === 'outgoing_chat_message' ||
          event.type === 'incoming_call' ||
          event.type === 'outgoing_call' ||
          event.type === 'call_completed' ||
          event.type === 'sms_added' ||
          event.type === 'email_added'
        )
        
        console.log(`📊 Fallback: Found ${messageEvents.length} communication events`)
        
        return messageEvents.map((event: any) => {
          let text = ''
          switch(event.type) {
            case 'incoming_chat_message':
              text = 'Incoming message from client'
              break
            case 'outgoing_chat_message':
              text = 'Outgoing message to client'
              break
            case 'incoming_call':
              text = 'Incoming call from client'
              break
            case 'outgoing_call':
              text = 'Outgoing call to client'
              break
            case 'call_completed':
              text = 'Call completed'
              break
            case 'sms_added':
              text = 'SMS sent'
              break
            case 'email_added':
              text = 'Email sent'
              break
            default:
              text = event.type.replace(/_/g, ' ')
          }
          
          return {
            id: event.id,
            text: text,
            type: event.type,
            created_at: event.created_at,
            responsible_user_id: event.created_by
          }
        })
      } catch (fallbackError) {
        console.error(`Fallback also failed:`, fallbackError)
        return []
      }
    }
  }

  async getLeadNotes(leadId: number): Promise<any[]> {
    if (isDemoMode) {
      // Return demo notes
      return [
        {
          id: 1,
          text: "Initial contact made. Lead seems very interested in our enterprise solution.",
          created_at: Date.now() / 1000 - 7200,
          responsible_user_id: 1
        },
        {
          id: 2,
          text: "Follow-up call scheduled for next week. Lead mentioned budget approval process.",
          created_at: Date.now() / 1000 - 3600,
          responsible_user_id: 1
        }
      ]
    }
    
    try {
      // Try different possible endpoints for notes
      const possibleEndpoints = [
        `/leads/${leadId}/notes`,
        `/notes?filter[lead_id]=${leadId}`,
        `/leads/${leadId}/events`,
        `/events?filter[lead_id]=${leadId}`
      ]
      
      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`🔄 Trying notes endpoint: ${endpoint}`)
          const response = await api.get(endpoint)
          if (response.data && (response.data._embedded?.notes || response.data._embedded?.events || response.data.length > 0)) {
            console.log(`✅ Found notes using endpoint: ${endpoint}`)
            const notes = response.data._embedded?.notes || response.data._embedded?.events || response.data || []
            
            // Test: Show actual note content
            if (notes.length > 0) {
              console.log(`📝 NOTE CONTENT TEST:`)
              notes.slice(0, 3).forEach((note: any, index: number) => {
                console.log(`  Note ${index + 1}: "${note.params?.text || note.text || 'No text content'}" (Type: ${note.note_type || 'unknown'})`)
              })
            }
            
            return notes
          }
        } catch (endpointError: any) {
          console.log(`❌ Notes endpoint ${endpoint} failed:`, endpointError.response?.status)
          continue
        }
      }
      
      console.log(`⚠️ No notes found for lead ${leadId} using any endpoint`)
      return []
    } catch (error) {
      console.error(`Error fetching notes for lead ${leadId}:`, error)
      return []
    }
  }

  async getLeadById(leadId: number): Promise<Lead> {
    if (isDemoMode) {
      const demoData = getDemoData()
      return demoData.leads.find(lead => lead.id === leadId) || demoData.leads[0]
    }
    
    try {
      const response = await api.get(`/leads/${leadId}`, {
        params: {
          with: 'contacts,companies'
        }
      })
      return response.data
    } catch (error) {
      console.error(`Error fetching lead ${leadId}:`, error)
      throw new Error(`Failed to fetch lead ${leadId}`)
    }
  }

  async getLeadCommunications(leadId: number): Promise<{
    messages: any[]
    notes: any[]
  }> {
    try {
      const [messages, notes] = await Promise.all([
        this.getLeadMessages(leadId),
        this.getLeadNotes(leadId)
      ])
      return { messages, notes }
    } catch (error) {
      console.error(`Error fetching communications for lead ${leadId}:`, error)
      return { messages: [], notes: [] }
    }
  }
}

export const kommoClient = new KommoClient()
