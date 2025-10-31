import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { leads } = await request.json()
    
    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json(
        { error: 'Invalid leads data' },
        { status: 400 }
      )
    }

    const scoredLeads = []
    const errors = []
    let successCount = 0
    let errorCount = 0
    let stopped = false
    
    console.log(`🤖 Starting AI scoring for ${leads.length} leads...`)
    
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      try {
        console.log(`🔄 Scoring lead ${i + 1}/${leads.length}: ${lead.name || lead.id}`)
        const leadData = extractLeadData(lead)
        const { score, reason } = await scoreLeadWithAI(leadData)
        
        scoredLeads.push({
          ...lead,
          ai_score: score,
          ai_reason: reason
        })
        successCount++
        console.log(`✅ Successfully scored lead ${lead.name || lead.id} with score: ${score}`)
        
        // Add delay between requests to respect rate limits (3 RPM = 20 seconds between requests)
        if (i < leads.length - 1) {
          console.log(`⏳ Waiting 21 seconds before next request to respect rate limits...`)
          await new Promise(resolve => setTimeout(resolve, 21000))
        }
        
      } catch (error: any) {
        console.error(`❌ Error scoring lead ${lead.name || lead.id}:`, error)
        errorCount++
        
        // Determine if it's a critical OpenAI API error that should stop scoring
        const isRateLimitError = error?.message?.includes('429') ||
                                error?.message?.includes('Rate limit') ||
                                error?.message?.includes('rate limit')
        
        const isQuotaError = error?.message?.includes('quota') ||
                            error?.message?.includes('insufficient_quota')
        
        const isBillingError = error?.message?.includes('billing') ||
                              error?.message?.includes('payment')
        
        const isOpenAIError = error?.message?.includes('OpenAI') || 
                             error?.message?.includes('API') ||
                             isRateLimitError ||
                             isQuotaError ||
                             isBillingError
        
        const errorMessage = isOpenAIError 
          ? `OpenAI API Error: ${error.message}`
          : `Scoring Error: ${error.message}`
        
        // Check if this is a critical error that should stop the scoring process
        if (isRateLimitError || isQuotaError || isBillingError) {
          console.error(`🛑 CRITICAL ERROR: ${errorMessage}`)
          console.error(`🛑 Stopping scoring process due to OpenAI API limits`)
          
          // Add error message to current lead
          scoredLeads.push({
            ...lead,
            ai_score: 5, // Default neutral score
            ai_reason: errorMessage
          })
          
          errors.push({
            leadId: lead.id,
            leadName: lead.name,
            error: errorMessage,
            critical: true
          })
          
          stopped = true
          break // Stop the loop immediately
        }
        
        // For non-critical errors, continue with default score
        scoredLeads.push({
          ...lead,
          ai_score: 5, // Default neutral score
          ai_reason: errorMessage
        })
        
        errors.push({
          leadId: lead.id,
          leadName: lead.name,
          error: errorMessage
        })
        
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    console.log(`📊 Scoring ${stopped ? 'STOPPED' : 'completed'}: ${successCount} successful, ${errorCount} errors`)
    if (errors.length > 0) {
      console.log(`⚠️ Errors encountered:`, errors)
    }
    
    return NextResponse.json({ 
      scoredLeads,
      summary: {
        total: leads.length,
        successful: successCount,
        errors: errorCount,
        stopped: stopped,
        errorDetails: errors
      }
    })
  } catch (error) {
    console.error('AI scoring API error:', error)
    return NextResponse.json(
      { error: 'Failed to score leads' },
      { status: 500 }
    )
  }
}

function extractLeadData(lead: any): string {
  // Safely extract embedded data
  const embedded = lead._embedded || {}
  const tags = embedded.tags || []
  const companies = embedded.companies || []
  const contacts = embedded.contacts || []
  
  // Extract company information from embedded companies
  const companyInfo = companies.length > 0 ? companies[0] : {}
  
  // Extract contact information from embedded contacts
  const contactInfo = contacts.length > 0 ? contacts[0] : {}
  
  // Try to extract contact info from events if not found in embedded data
  let extractedContactInfo = { phone: [] as string[], email: [] as string[], company: '', position: '' }
  if (lead.events && Array.isArray(lead.events)) {
    for (const event of lead.events) {
      if (event.phone && !extractedContactInfo.phone.includes(event.phone)) {
        extractedContactInfo.phone.push(event.phone)
      }
      if (event.email && !extractedContactInfo.email.includes(event.email)) {
        extractedContactInfo.email.push(event.email)
      }
      if (event.company && !extractedContactInfo.company) {
        extractedContactInfo.company = event.company
      }
      if (event.position && !extractedContactInfo.position) {
        extractedContactInfo.position = event.position
      }
    }
  }
  
  const leadData = {
    name: lead.name || '',
    company: companyInfo.name || lead.company_name || extractedContactInfo.company || '',
    position: contactInfo.position || lead.position || extractedContactInfo.position || '',
    phone: contactInfo.phone || lead.phone || extractedContactInfo.phone || [],
    email: contactInfo.email || lead.email || extractedContactInfo.email || [],
    custom_fields: lead.custom_fields_values || [],
    tags: tags.map((tag: any) => tag.name),
    pipeline: lead.pipeline?.name || '',
    status: lead.status?.name || '',
    created_at: lead.created_at || '',
    updated_at: lead.updated_at || '',
    responsible_user: lead.responsible_user_id || '',
    price: lead.price || 0,
    messages: lead.messages || [],
    notes: lead.notes || []
  }
  
  // Debug logging to see what data we're extracting
  console.log(`🔍 Extracting data for lead ${lead.id}:`)
  console.log(`  - Name: ${leadData.name}`)
  console.log(`  - Company: ${leadData.company}`)
  console.log(`  - Position: ${leadData.position}`)
  console.log(`  - Phone: ${JSON.stringify(leadData.phone)}`)
  console.log(`  - Email: ${JSON.stringify(leadData.email)}`)
  console.log(`  - Price: ${leadData.price}`)
  console.log(`  - Messages: ${leadData.messages.length}`)
  console.log(`  - Notes: ${leadData.notes.length}`)
  console.log(`  - Embedded companies: ${JSON.stringify(companies)}`)
  console.log(`  - Embedded contacts: ${JSON.stringify(contacts)}`)
  
  // Test: Show actual message content
  if (leadData.messages.length > 0) {
    console.log(`📋 MESSAGE CONTENT TEST:`)
    leadData.messages.slice(0, 3).forEach((msg: any, index: number) => {
      console.log(`  Message ${index + 1}: "${msg.text}" (Type: ${msg.type})`)
    })
  }
  
  // Test: Show actual note content
  if (leadData.notes.length > 0) {
    console.log(`📝 NOTE CONTENT TEST:`)
    leadData.notes.slice(0, 3).forEach((note: any, index: number) => {
      console.log(`  Note ${index + 1}: "${note.params?.text || note.text || 'No text content'}"`)
    })
  }
  
  console.log(`  - Raw lead data: ${JSON.stringify(lead, null, 2)}`)
  
  // Format custom fields
  let customFieldsText = ""
  const customFields = leadData.custom_fields || []
  for (const field of customFields) {
    const fieldName = field.field_name || ''
    const fieldValues = field.values || []
    if (fieldValues.length > 0) {
      customFieldsText += `${fieldName}: ${fieldValues.map((v: any) => v.value).join(', ')}\n`
    }
  }
  
  // Format contact info
  const phoneList = leadData.phone || []
  const emailList = leadData.email || []
  
  // Handle different phone/email formats
  let phoneText = 'No phone'
  let emailText = 'No email'
  
  if (Array.isArray(phoneList) && phoneList.length > 0) {
    phoneText = phoneList.map((p: any) => p.value || p).join(', ')
  } else if (typeof phoneList === 'string' && phoneList) {
    phoneText = phoneList
  }
  
  if (Array.isArray(emailList) && emailList.length > 0) {
    emailText = emailList.map((e: any) => e.value || e).join(', ')
  } else if (typeof emailList === 'string' && emailList) {
    emailText = emailList
  }
  
  // Format communication activity (messages = events like calls, chat messages)
  let activityText = ""
  const messages = leadData.messages || []
  const notes = leadData.notes || []
  
  // Combine messages and notes for a complete picture
  if (messages.length > 0 || notes.length > 0) {
    activityText = "\nCommunication Activity:\n"
    
    // Show message/call activity
    if (messages.length > 0) {
      activityText += `\nActivity Summary (${messages.length} events):\n`
      messages.slice(0, 10).forEach((msg: any, index: number) => {
        const date = new Date(msg.created_at * 1000).toLocaleDateString()
        activityText += `${index + 1}. [${date}] ${msg.text}\n`
      })
    }
    
    // Show notes (these have actual text content!)
    if (notes.length > 0) {
      activityText += `\nNotes (${notes.length} notes):\n`
      notes.slice(0, 10).forEach((note: any, index: number) => {
        const date = new Date(note.created_at * 1000).toLocaleDateString()
        const text = note.params?.text || note.text || 'No text'
        activityText += `${index + 1}. [${date}] "${text}"\n`
      })
    }
  } else {
    activityText = "\nCommunication Activity: No activity found"
  }
  
  return `
Lead Information:
- Name: ${leadData.name}
- Phone: ${phoneText}
- Email: ${emailText}

${activityText}
`
}

async function scoreLeadWithAI(leadData: string): Promise<{ score: number; reason: string }> {
  const prompt = `
You are an expert sales lead scorer. Analyze the following lead's COMMUNICATION ACTIVITY (messages, calls, notes) and provide a score from 1-10 based on engagement quality and likelihood to convert.

Scoring criteria based on COMMUNICATION ACTIVITY:
- 1-3: No activity, or very limited/negative engagement
- 4-5: Some activity present (calls, messages, notes showing basic interest)
- 6-7: Good engagement (multiple touchpoints, responsive, asking questions, notes show interest)
- 8-9: Strong engagement (frequent communication, detailed discussions, budget/timeline mentions in notes)
- 10: Excellent (high volume of positive interactions, notes indicate ready to buy, decision-maker involved)

Analyze these communication indicators:
- **Call activity**: Incoming/outgoing calls show engagement level
- **Message activity**: Incoming/outgoing messages indicate interest
- **Notes content**: Look for keywords like "interested", "budget", "timeline", "will call back", "scheduled", "confirmed"
- **Communication frequency**: More touchpoints = higher engagement
- **Responsiveness**: Quick responses or callbacks show interest

Special attention to notes mentioning:
- Interest indicators: "interested", "will attend", "wants information", "confirmed"
- Scheduling: "scheduled appointment", "will come tomorrow", "meeting at X time"
- Budget/pricing: "budget", "price", "paid", "payment"
- Positive outcomes: "confirmed registration", "agreed", "accepted"
- Negative signals: "not interested", "injoignable" (unreachable), "declined"

If very limited communication data, score based on:
- Has contact info + some activity: score 4-5
- Has contact info only: score 3
- No contact info or communication: score 2

Lead Data:
${leadData}

Provide your response in this exact format:
SCORE: [number from 1-10]
REASON: [brief explanation based on communication activity analysis]

Example:
SCORE: 7
REASON: Good engagement - multiple incoming/outgoing messages, call activity, and notes indicate client is interested and will attend meeting
`
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a sales lead scoring expert. Always respond with SCORE: [number] and REASON: [explanation] format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    })
    
    const responseText = response.choices[0].message.content?.trim() || ''
    
    // Extract score and reason
    const scoreMatch = responseText.match(/SCORE:\s*(\d+)/)
    const reasonMatch = responseText.match(/REASON:\s*(.+)/)
    
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1])
      const reason = reasonMatch?.[1]?.trim() || "No reason provided"
      return { score, reason }
    } else {
      return { score: 5, reason: "Unable to parse AI response" }
    }
  } catch (error) {
    console.error('OpenAI API error:', error)
    return { score: 5, reason: `Error: ${error}` }
  }
}

