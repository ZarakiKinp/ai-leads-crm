from typing import List, Dict
from kommo_client import KommoClient
from ai_scorer import AILeadScorer
import time

class LeadProcessor:
    def __init__(self):
        self.kommo_client = KommoClient()
        self.ai_scorer = AILeadScorer()
    
    def process_all_leads(self) -> Dict:
        """Process all leads: score them and add tags"""
        print("Fetching all leads from all pipelines...")
        all_leads = self.kommo_client.get_all_leads()
        
        if not all_leads:
            return {"error": "No leads found"}
        
        print(f"Found {len(all_leads)} leads to process")
        
        # Score all leads
        print("Scoring leads with AI...")
        scored_leads = self.ai_scorer.batch_score_leads(all_leads)
        
        # Add score tags to leads
        print("Adding score tags to leads...")
        tagged_count = 0
        high_score_leads = []
        
        for lead in scored_leads:
            lead_id = lead.get('id')
            score = lead.get('ai_score', 0)
            
            # Add score tag
            tag_name = f"AI_Score_{score}"
            result = self.kommo_client.add_tag_to_lead(lead_id, tag_name)
            
            if result:
                tagged_count += 1
                print(f"Added tag '{tag_name}' to lead {lead_id}")
            
            # Collect high-scoring leads (score >= 5)
            if score >= 5:
                high_score_leads.append(lead)
            
            # Small delay to avoid rate limiting
            time.sleep(0.1)
        
        return {
            "total_leads": len(all_leads),
            "tagged_leads": tagged_count,
            "high_score_leads": high_score_leads,
            "high_score_count": len(high_score_leads)
        }
    
    def move_high_score_leads(self, target_pipeline_id: int, target_status_id: int = None) -> Dict:
        """Move high-scoring leads (score >= 5) to target pipeline"""
        print("Processing leads to find high-scoring ones...")
        result = self.process_all_leads()
        
        if "error" in result:
            return result
        
        high_score_leads = result["high_score_leads"]
        
        if not high_score_leads:
            return {"message": "No high-scoring leads found"}
        
        # If no target status specified, get the first status of the target pipeline
        if not target_status_id:
            statuses = self.kommo_client.get_pipeline_statuses(target_pipeline_id)
            if statuses:
                target_status_id = statuses[0].get('id')
            else:
                return {"error": "Could not find statuses for target pipeline"}
        
        moved_count = 0
        
        for lead in high_score_leads:
            lead_id = lead.get('id')
            current_pipeline = lead.get('pipeline', {}).get('id')
            
            # Only move if not already in target pipeline
            if current_pipeline != target_pipeline_id:
                result = self.kommo_client.move_lead_to_pipeline(
                    lead_id, 
                    target_pipeline_id, 
                    target_status_id
                )
                
                if result:
                    moved_count += 1
                    print(f"Moved lead {lead_id} to pipeline {target_pipeline_id}")
                
                # Small delay to avoid rate limiting
                time.sleep(0.1)
        
        return {
            "moved_leads": moved_count,
            "total_high_score": len(high_score_leads),
            "target_pipeline": target_pipeline_id
        }
    
    def get_lead_scores_summary(self) -> Dict:
        """Get a summary of lead scores"""
        all_leads = self.kommo_client.get_all_leads()
        scored_leads = self.ai_scorer.batch_score_leads(all_leads)
        
        score_distribution = {}
        for lead in scored_leads:
            score = lead.get('ai_score', 0)
            score_distribution[score] = score_distribution.get(score, 0) + 1
        
        return {
            "total_leads": len(scored_leads),
            "score_distribution": score_distribution,
            "high_score_leads": [lead for lead in scored_leads if lead.get('ai_score', 0) >= 5]
        }
