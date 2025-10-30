import { Lead } from './kommo-client'

export interface ScoredLead extends Lead {
  ai_score: number
  ai_reason: string
}

export class AILeadScorer {
  async scoreSingleLead(lead: Lead): Promise<ScoredLead> {
    try {
      const response = await fetch('/api/ai/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads: [lead] }),
      })
      
      if (!response.ok) {
        throw new Error(`AI scoring API error: ${response.status}`)
      }
      
      const { scoredLeads, summary } = await response.json()
      
      // Check if scoring was stopped due to rate limit or other critical error
      if (summary?.stopped) {
        const criticalError = summary.errorDetails?.find((e: any) => e.critical)
        if (criticalError) {
          // Throw a special error that will stop the entire scoring process
          const error = new Error(criticalError.error)
          error.name = 'RateLimitError'
          throw error
        }
      }
      
      // Check if this specific lead had a rate limit error
      const scoredLead = scoredLeads[0]
      if (scoredLead?.ai_reason?.includes('429') || 
          scoredLead?.ai_reason?.includes('Rate limit') ||
          scoredLead?.ai_reason?.includes('rate limit')) {
        const error = new Error(scoredLead.ai_reason)
        error.name = 'RateLimitError'
        throw error
      }
      
      return scoredLead
    } catch (error: any) {
      console.error('Error in single lead scoring:', error)
      
      // Re-throw rate limit errors so they can be caught and stop the process
      if (error.name === 'RateLimitError') {
        throw error
      }
      
      // Fallback: return lead with default score for other errors
      return {
        ...lead,
        ai_score: 5,
        ai_reason: `Error: ${error}`
      }
    }
  }

  async batchScoreLeads(leads: Lead[]): Promise<ScoredLead[]> {
    try {
      const response = await fetch('/api/ai/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads }),
      })
      
      if (!response.ok) {
        throw new Error(`AI scoring API error: ${response.status}`)
      }
      
      const { scoredLeads, summary } = await response.json()
      
      // Log summary information
      if (summary) {
        console.log(`📊 AI Scoring Summary:`)
        console.log(`  - Total leads: ${summary.total}`)
        console.log(`  - Successfully scored: ${summary.successful}`)
        console.log(`  - Errors: ${summary.errors}`)
        
        if (summary.errors > 0) {
          console.log(`⚠️ Error details:`, summary.errorDetails)
        }
      }
      
      return scoredLeads
    } catch (error) {
      console.error('Error in batch scoring:', error)
      
      // Fallback: return leads with default scores
      return leads.map(lead => ({
        ...lead,
        ai_score: 5,
        ai_reason: `Error: ${error}`
      }))
    }
  }
}

export const aiScorer = new AILeadScorer()
