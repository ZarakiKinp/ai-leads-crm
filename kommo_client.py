import requests
import json
from typing import List, Dict, Optional
from config import KOMMO_BASE_URL, KOMMO_API_KEY

class KommoClient:
    def __init__(self):
        self.base_url = KOMMO_BASE_URL
        self.headers = {
            'Authorization': f'Bearer {KOMMO_API_KEY}',
            'Content-Type': 'application/json'
        }
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make API request to Kommo"""
        url = f"{self.base_url}/{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=self.headers)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=self.headers, json=data)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, headers=self.headers, json=data)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"API request failed: {e}")
            return {}
    
    def get_pipelines(self) -> List[Dict]:
        """Get all pipelines"""
        response = self._make_request('GET', 'leads/pipelines')
        return response.get('_embedded', {}).get('pipelines', [])
    
    def get_leads_from_pipeline(self, pipeline_id: int, limit: int = 250) -> List[Dict]:
        """Get all leads from a specific pipeline"""
        params = {
            'filter[pipeline_id]': pipeline_id,
            'limit': limit
        }
        
        all_leads = []
        page = 1
        
        while True:
            params['page'] = page
            response = self._make_request('GET', f"leads?filter[pipeline_id]={pipeline_id}&limit={limit}&page={page}")
            
            leads = response.get('_embedded', {}).get('leads', [])
            if not leads:
                break
                
            all_leads.extend(leads)
            page += 1
            
            # Break if we got less than the limit (last page)
            if len(leads) < limit:
                break
        
        return all_leads
    
    def get_all_leads(self) -> List[Dict]:
        """Get all leads from all pipelines"""
        pipelines = self.get_pipelines()
        all_leads = []
        
        for pipeline in pipelines:
            pipeline_id = pipeline.get('id')
            leads = self.get_leads_from_pipeline(pipeline_id)
            all_leads.extend(leads)
        
        return all_leads
    
    def update_lead(self, lead_id: int, data: Dict) -> Dict:
        """Update a lead"""
        return self._make_request('PATCH', f'leads/{lead_id}', data)
    
    def add_tag_to_lead(self, lead_id: int, tag_name: str) -> Dict:
        """Add a tag to a lead"""
        # First, get the current lead data
        lead_data = self._make_request('GET', f'leads/{lead_id}')
        if not lead_data:
            return {}
        
        # Get current tags
        current_tags = lead_data.get('_embedded', {}).get('tags', [])
        current_tag_names = [tag.get('name') for tag in current_tags]
        
        # Add new tag if not already present
        if tag_name not in current_tag_names:
            current_tag_names.append(tag_name)
        
        # Update the lead with new tags
        update_data = {
            'tags': current_tag_names
        }
        
        return self.update_lead(lead_id, update_data)
    
    def move_lead_to_pipeline(self, lead_id: int, pipeline_id: int, status_id: int) -> Dict:
        """Move a lead to a different pipeline and status"""
        update_data = {
            'pipeline_id': pipeline_id,
            'status_id': status_id
        }
        
        return self.update_lead(lead_id, update_data)
    
    def get_pipeline_statuses(self, pipeline_id: int) -> List[Dict]:
        """Get all statuses for a pipeline"""
        response = self._make_request('GET', f'leads/pipelines/{pipeline_id}/statuses')
        return response.get('_embedded', {}).get('statuses', [])
