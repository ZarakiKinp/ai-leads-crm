import openai
from typing import Dict, List
from config import OPENAI_API_KEY

class AILeadScorer:
    def __init__(self):
        openai.api_key = OPENAI_API_KEY
        self.client = openai.OpenAI(api_key=OPENAI_API_KEY)
    
    def extract_lead_data(self, lead: Dict) -> str:
        """Extract relevant data from a lead for AI analysis"""
        # Safely extract embedded data
        embedded = lead.get('_embedded', {}) or {}
        tags = embedded.get('tags', []) or []
        
        lead_data = {
            'name': lead.get('name', ''),
            'company': lead.get('company_name', ''),
            'position': lead.get('position', ''),
            'phone': lead.get('phone', []) or [],
            'email': lead.get('email', []) or [],
            'custom_fields': lead.get('custom_fields_values', []) or [],
            'tags': [tag.get('name', '') for tag in tags if tag],
            'pipeline': lead.get('pipeline', {}).get('name', '') if lead.get('pipeline') else '',
            'status': lead.get('status', {}).get('name', '') if lead.get('status') else '',
            'created_at': lead.get('created_at', ''),
            'updated_at': lead.get('updated_at', ''),
            'responsible_user': lead.get('responsible_user_id', ''),
            'price': lead.get('price', 0)
        }
        
        # Format custom fields
        custom_fields_text = ""
        custom_fields = lead_data['custom_fields'] or []
        for field in custom_fields:
            field_name = field.get('field_name', '')
            field_values = field.get('values', [])
            if field_values:
                custom_fields_text += f"{field_name}: {', '.join([str(v.get('value', '')) for v in field_values])}\n"
        
        # Format contact info
        phone_list = lead_data['phone'] or []
        email_list = lead_data['email'] or []
        phone_text = ', '.join([str(p.get('value', '')) for p in phone_list]) if phone_list else 'No phone'
        email_text = ', '.join([str(e.get('value', '')) for e in email_list]) if email_list else 'No email'
        
        lead_summary = f"""
Lead Information:
- Name: {lead_data['name']}
- Company: {lead_data['company']}
- Position: {lead_data['position']}
- Phone: {phone_text}
- Email: {email_text}
- Pipeline: {lead_data['pipeline']}
- Status: {lead_data['status']}
- Price: {lead_data['price']}
- Tags: {', '.join(lead_data['tags']) if lead_data['tags'] else 'No tags'}
- Created: {lead_data['created_at']}
- Updated: {lead_data['updated_at']}

Custom Fields:
{custom_fields_text}
"""
        return lead_summary
    
    def score_lead(self, lead: Dict) -> tuple:
        """Score a lead from 1-10 using AI and return score with reason"""
        lead_data = self.extract_lead_data(lead)
        
        prompt = f"""
You are an expert sales lead scorer. Analyze the following lead information and provide a score from 1-10 based on lead quality, potential value, and likelihood to convert.

Scoring criteria:
- 1-3: Low quality lead (poor contact info, no clear value, unlikely to convert)
- 4-6: Medium quality lead (decent contact info, some potential, moderate conversion chance)
- 7-8: High quality lead (good contact info, clear value proposition, likely to convert)
- 9-10: Excellent lead (complete info, high value, very likely to convert)

Consider these factors:
- Contact information completeness (phone, email)
- Company size and position
- Lead source and pipeline stage
- Custom field data
- Price/value indicators
- Tags and previous interactions

Lead Data:
{lead_data}

Provide your response in this exact format:
SCORE: [number from 1-10]
REASON: [brief explanation of why this score was given]

Example:
SCORE: 7
REASON: Good contact information, established company, clear position, moderate price value
"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a sales lead scoring expert. Always respond with SCORE: [number] and REASON: [explanation] format."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.3
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Extract score and reason
            import re
            score_match = re.search(r'SCORE:\s*(\d+)', response_text)
            reason_match = re.search(r'REASON:\s*(.+)', response_text)
            
            if score_match:
                score = int(score_match.group(1))
                reason = reason_match.group(1).strip() if reason_match else "No reason provided"
                return score, reason
            else:
                # Default if parsing fails
                return 5, "Unable to parse AI response"
                
        except Exception as e:
            print(f"Error scoring lead {lead.get('id', 'unknown')}: {e}")
            return 5, f"Error: {str(e)}"  # Default score on error
    
    def batch_score_leads(self, leads: List[Dict]) -> List[Dict]:
        """Score multiple leads and return with scores and reasons"""
        scored_leads = []
        
        for i, lead in enumerate(leads):
            try:
                print(f"Scoring lead {i+1}/{len(leads)}: {lead.get('name', 'Unknown')}")
                score, reason = self.score_lead(lead)
                
                lead_with_score = lead.copy()
                lead_with_score['ai_score'] = score
                lead_with_score['ai_reason'] = reason
                scored_leads.append(lead_with_score)
            except Exception as e:
                print(f"Error processing lead {i+1}: {e}")
                # Add lead with default score
                lead_with_score = lead.copy()
                lead_with_score['ai_score'] = 5
                lead_with_score['ai_reason'] = f"Error: {str(e)}"
                scored_leads.append(lead_with_score)
        
        return scored_leads
