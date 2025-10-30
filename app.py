import streamlit as st
import pandas as pd
import time
from kommo_client import KommoClient
from lead_processor import LeadProcessor

# Page configuration
st.set_page_config(
    page_title="Kommo Lead Scoring App",
    page_icon="🎯",
    layout="wide"
)

# Initialize clients
@st.cache_resource
def get_clients():
    return KommoClient(), LeadProcessor()

kommo_client, lead_processor = get_clients()

# Main title
st.title("🎯 Kommo Lead Scoring App")
st.markdown("AI-powered lead scoring and pipeline management for Kommo CRM")

# Sidebar for navigation
st.sidebar.title("Navigation")
page = st.sidebar.selectbox("Choose a page", [
    "Dashboard",
    "Score All Leads", 
    "Move High-Score Leads",
    "Pipeline Management",
    "Lead Analytics"
])

if page == "Dashboard":
    st.header("📊 Dashboard")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Pipelines", "Loading...")
    
    with col2:
        st.metric("Total Leads", "Loading...")
    
    with col3:
        st.metric("High-Score Leads", "Loading...")
    
    # Get basic stats
    try:
        pipelines = kommo_client.get_pipelines()
        all_leads = kommo_client.get_all_leads()
        
        st.metric("Total Pipelines", len(pipelines))
        st.metric("Total Leads", len(all_leads))
        
        # Show pipelines
        st.subheader("📋 Available Pipelines")
        pipeline_df = pd.DataFrame([
            {
                "ID": pipeline.get('id'),
                "Name": pipeline.get('name'),
                "Statuses": len(pipeline.get('statuses', []))
            }
            for pipeline in pipelines
        ])
        st.dataframe(pipeline_df, use_container_width=True)
        
    except Exception as e:
        st.error(f"Error loading data: {e}")

elif page == "Score All Leads":
    st.header("🤖 Score All Leads")
    st.markdown("This will analyze leads from all pipelines and add AI scores as tags.")
    
    # Get total leads count first
    try:
        all_leads = kommo_client.get_all_leads()
        total_leads = len(all_leads)
        
        if total_leads == 0:
            st.warning("No leads found in your Kommo account.")
        else:
            st.info(f"📊 Total leads available: {total_leads}")
            
            # Ask user how many leads to score
            col1, col2 = st.columns([2, 1])
            
            with col1:
                max_leads = min(total_leads, 1000)  # Cap at 1000 for performance
                num_leads = st.slider(
                    "How many leads do you want to score?",
                    min_value=1,
                    max_value=max_leads,
                    value=min(50, total_leads),  # Default to 50 or total if less
                    help=f"Maximum: {max_leads} leads. Scoring takes time, so start with a smaller number for testing."
                )
            
            with col2:
                st.metric("Selected Leads", num_leads)
            
            # Show estimated time
            estimated_time = num_leads * 2  # Roughly 2 seconds per lead
            st.info(f"⏱️ Estimated time: {estimated_time//60}m {estimated_time%60}s")
            
            if st.button("🚀 Start Scoring Process", type="primary"):
                with st.spinner(f"Processing {num_leads} leads... This may take a few minutes."):
                    # Limit leads to the requested number
                    leads_to_score = all_leads[:num_leads]
                    
                    # Score the selected leads
                    scored_leads = lead_processor.ai_scorer.batch_score_leads(leads_to_score)
                    
                    # Add tags to leads
                    tagged_count = 0
                    high_score_leads = []
                    
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    for i, lead in enumerate(scored_leads):
                        lead_id = lead.get('id')
                        score = lead.get('ai_score', 0)
                        
                        # Add score tag
                        tag_name = f"AI_Score_{score}"
                        result = kommo_client.add_tag_to_lead(lead_id, tag_name)
                        
                        if result:
                            tagged_count += 1
                        
                        # Collect high-scoring leads (score >= 5)
                        if score >= 5:
                            high_score_leads.append(lead)
                        
                        # Update progress
                        progress = (i + 1) / len(scored_leads)
                        progress_bar.progress(progress)
                        status_text.text(f"Processing lead {i+1}/{len(scored_leads)}: {lead.get('name', 'Unknown')}")
                        
                        # Small delay to avoid rate limiting
                        time.sleep(0.1)
                
                st.success(f"✅ Successfully processed {len(scored_leads)} leads!")
                st.info(f"📊 Tagged {tagged_count} leads with AI scores")
                st.info(f"⭐ Found {len(high_score_leads)} high-scoring leads (score ≥ 5)")
                
                # Show score distribution
                if scored_leads:
                    st.subheader("📊 Score Distribution")
                    score_counts = {}
                    for lead in scored_leads:
                        score = lead.get('ai_score', 0)
                        score_counts[score] = score_counts.get(score, 0) + 1
                    
                    score_df = pd.DataFrame([
                        {"Score": score, "Count": count}
                        for score, count in sorted(score_counts.items())
                    ])
                    st.bar_chart(score_df.set_index('Score'))
                
                # Show ALL scored leads
                st.subheader("📋 All Scored Leads")
                all_scored_df = pd.DataFrame([
                    {
                        "ID": lead.get('id'),
                        "Name": lead.get('name'),
                        "Company": lead.get('company_name', ''),
                        "AI Score": lead.get('ai_score'),
                        "Scoring Reason": lead.get('ai_reason', 'No reason provided'),
                        "Pipeline": lead.get('pipeline', {}).get('name', ''),
                        "Status": lead.get('status', {}).get('name', '') if isinstance(lead.get('status'), dict) else 'Unknown',
                        "Price": lead.get('price', 0)
                    }
                    for lead in scored_leads
                ])
                st.dataframe(all_scored_df, use_container_width=True)
                
                # Show high-scoring leads separately
                if high_score_leads:
                    st.subheader("⭐ High-Scoring Leads (Score ≥ 5)")
                    high_score_df = pd.DataFrame([
                        {
                            "ID": lead.get('id'),
                            "Name": lead.get('name'),
                            "Company": lead.get('company_name', ''),
                            "Score": lead.get('ai_score'),
                            "Reason": lead.get('ai_reason', 'No reason provided'),
                            "Pipeline": lead.get('pipeline', {}).get('name', ''),
                            "Status": lead.get('status', {}).get('name', '') if isinstance(lead.get('status'), dict) else 'Unknown'
                        }
                        for lead in high_score_leads
                    ])
                    st.dataframe(high_score_df, use_container_width=True)
    
    except Exception as e:
        st.error(f"Error loading leads: {e}")

elif page == "Move High-Score Leads":
    st.header("📤 Move High-Score Leads")
    st.markdown("Move leads with AI score ≥ 5 to a target pipeline.")
    
    # Get pipelines for selection
    try:
        pipelines = kommo_client.get_pipelines()
        pipeline_options = {f"{p.get('name')} (ID: {p.get('id')})": p.get('id') for p in pipelines}
        
        target_pipeline = st.selectbox("Select Target Pipeline", list(pipeline_options.keys()))
        target_pipeline_id = pipeline_options[target_pipeline]
        
        # Get statuses for the selected pipeline
        statuses = kommo_client.get_pipeline_statuses(target_pipeline_id)
        status_options = {f"{s.get('name')} (ID: {s.get('id')})": s.get('id') for s in statuses}
        
        target_status = st.selectbox("Select Target Status", list(status_options.keys()))
        target_status_id = status_options[target_status]
        
        # Get total leads count
        all_leads = kommo_client.get_all_leads()
        total_leads = len(all_leads)
        
        if total_leads == 0:
            st.warning("No leads found in your Kommo account.")
        else:
            st.info(f"📊 Total leads available: {total_leads}")
            
            # Ask user how many leads to process
            col1, col2 = st.columns([2, 1])
            
            with col1:
                max_leads = min(total_leads, 1000)  # Cap at 1000 for performance
                num_leads = st.slider(
                    "How many leads do you want to process?",
                    min_value=1,
                    max_value=max_leads,
                    value=min(50, total_leads),  # Default to 50 or total if less
                    help=f"Maximum: {max_leads} leads. Processing takes time, so start with a smaller number for testing."
                )
            
            with col2:
                st.metric("Selected Leads", num_leads)
            
            # Show estimated time
            estimated_time = num_leads * 2  # Roughly 2 seconds per lead
            st.info(f"⏱️ Estimated time: {estimated_time//60}m {estimated_time%60}s")
            
            if st.button("🚀 Move High-Score Leads", type="primary"):
                with st.spinner(f"Processing {num_leads} leads... This may take a few minutes."):
                    # Limit leads to the requested number
                    leads_to_process = all_leads[:num_leads]
                    
                    # Score the selected leads first
                    scored_leads = lead_processor.ai_scorer.batch_score_leads(leads_to_process)
                    
                    # Find high-scoring leads
                    high_score_leads = [lead for lead in scored_leads if lead.get('ai_score', 0) >= 5]
                    
                    if not high_score_leads:
                        st.info("No high-scoring leads found in the selected batch.")
                    else:
                        # Move high-scoring leads
                        moved_count = 0
                        
                        progress_bar = st.progress(0)
                        status_text = st.empty()
                        
                        for i, lead in enumerate(high_score_leads):
                            lead_id = lead.get('id')
                            current_pipeline = lead.get('pipeline', {}).get('id')
                            
                            # Only move if not already in target pipeline
                            if current_pipeline != target_pipeline_id:
                                result = kommo_client.move_lead_to_pipeline(
                                    lead_id, 
                                    target_pipeline_id, 
                                    target_status_id
                                )
                                
                                if result:
                                    moved_count += 1
                            
                            # Update progress
                            progress = (i + 1) / len(high_score_leads)
                            progress_bar.progress(progress)
                            status_text.text(f"Moving lead {i+1}/{len(high_score_leads)}: {lead.get('name', 'Unknown')}")
                            
                            # Small delay to avoid rate limiting
                            time.sleep(0.1)
                        
                        st.success(f"✅ Successfully moved {moved_count} high-scoring leads!")
                        st.info(f"📊 Total high-scoring leads found: {len(high_score_leads)}")
                        st.info(f"🎯 Target pipeline: {target_pipeline}")
                        
                        # Show moved leads
                        if moved_count > 0:
                            st.subheader("📤 Moved Leads")
                            moved_df = pd.DataFrame([
                                {
                                    "ID": lead.get('id'),
                                    "Name": lead.get('name'),
                                    "Company": lead.get('company_name', ''),
                                    "Score": lead.get('ai_score'),
                                    "Reason": lead.get('ai_reason', 'No reason provided'),
                                    "Previous Pipeline": lead.get('pipeline', {}).get('name', ''),
                                    "New Status": target_status
                                }
                                for lead in high_score_leads[:moved_count]
                            ])
                            st.dataframe(moved_df, use_container_width=True)
    
    except Exception as e:
        st.error(f"Error loading pipelines: {e}")

elif page == "Pipeline Management":
    st.header("📋 Pipeline Management")
    
    try:
        pipelines = kommo_client.get_pipelines()
        
        # Add lead count selection for pipeline analysis
        st.subheader("🔍 Pipeline Analysis")
        
        # Get total leads count
        all_leads = kommo_client.get_all_leads()
        total_leads = len(all_leads)
        
        if total_leads == 0:
            st.warning("No leads found in your Kommo account.")
        else:
            st.info(f"📊 Total leads available: {total_leads}")
            
            # Ask user how many leads to analyze per pipeline
            col1, col2 = st.columns([2, 1])
            
            with col1:
                max_leads = min(100, total_leads)  # Cap at 100 for pipeline view
                num_leads = st.slider(
                    "How many leads to show per pipeline?",
                    min_value=5,
                    max_value=max_leads,
                    value=min(20, total_leads),  # Default to 20 or total if less
                    help=f"Maximum: {max_leads} leads per pipeline for better performance."
                )
            
            with col2:
                st.metric("Leads per Pipeline", num_leads)
        
        for pipeline in pipelines:
            with st.expander(f"📊 {pipeline.get('name')} (ID: {pipeline.get('id')})"):
                # Get leads from this pipeline
                all_pipeline_leads = kommo_client.get_leads_from_pipeline(pipeline.get('id'))
                total_pipeline_leads = len(all_pipeline_leads)
                
                st.write(f"**Total Leads in Pipeline:** {total_pipeline_leads}")
                
                if all_pipeline_leads:
                    # Limit leads based on user selection
                    leads_to_show = all_pipeline_leads[:num_leads] if total_leads > 0 else all_pipeline_leads[:10]
                    
                    if len(leads_to_show) < total_pipeline_leads:
                        st.info(f"Showing first {len(leads_to_show)} of {total_pipeline_leads} leads")
                    
                    # Show leads
                    leads_df = pd.DataFrame([
                        {
                            "ID": lead.get('id'),
                            "Name": lead.get('name'),
                            "Company": lead.get('company_name', ''),
                            "Status": lead.get('status', {}).get('name', '') if isinstance(lead.get('status'), dict) else 'Unknown',
                            "Price": lead.get('price', 0),
                            "Created": lead.get('created_at', '')[:10] if lead.get('created_at') else ''
                        }
                        for lead in leads_to_show
                    ])
                    st.dataframe(leads_df, use_container_width=True)
                    
                    # Show pipeline statistics
                    if leads_to_show:
                        st.subheader("📈 Pipeline Statistics")
                        col1, col2, col3 = st.columns(3)
                        
                        with col1:
                            avg_price = sum(lead.get('price', 0) for lead in leads_to_show) / len(leads_to_show)
                            st.metric("Average Price", f"${avg_price:,.2f}")
                        
                        with col2:
                            status_counts = {}
                            for lead in leads_to_show:
                                status_obj = lead.get('status')
                                if isinstance(status_obj, dict):
                                    status = status_obj.get('name', 'Unknown')
                                else:
                                    status = 'Unknown'
                                status_counts[status] = status_counts.get(status, 0) + 1
                            most_common_status = max(status_counts.items(), key=lambda x: x[1])[0] if status_counts else 'None'
                            st.metric("Most Common Status", most_common_status)
                        
                        with col3:
                            companies = set(lead.get('company_name', '') for lead in leads_to_show if lead.get('company_name'))
                            st.metric("Unique Companies", len(companies))
                
                # Show statuses
                statuses = kommo_client.get_pipeline_statuses(pipeline.get('id'))
                st.write("**Available Statuses:**")
                for status in statuses:
                    st.write(f"- {status.get('name')} (ID: {status.get('id')})")
    
    except Exception as e:
        st.error(f"Error loading pipeline data: {e}")

elif page == "Lead Analytics":
    st.header("📈 Lead Analytics")
    
    # Get total leads count
    try:
        all_leads = kommo_client.get_all_leads()
        total_leads = len(all_leads)
        
        if total_leads == 0:
            st.warning("No leads found in your Kommo account.")
        else:
            st.info(f"📊 Total leads available: {total_leads}")
            
            # Ask user how many leads to analyze
            col1, col2 = st.columns([2, 1])
            
            with col1:
                max_leads = min(total_leads, 1000)  # Cap at 1000 for performance
                num_leads = st.slider(
                    "How many leads do you want to analyze?",
                    min_value=1,
                    max_value=max_leads,
                    value=min(100, total_leads),  # Default to 100 or total if less
                    help=f"Maximum: {max_leads} leads. Analysis takes time, so start with a smaller number for testing."
                )
            
            with col2:
                st.metric("Selected Leads", num_leads)
            
            # Show estimated time
            estimated_time = num_leads * 2  # Roughly 2 seconds per lead
            st.info(f"⏱️ Estimated time: {estimated_time//60}m {estimated_time%60}s")
            
            if st.button("📊 Generate Analytics", type="primary"):
                with st.spinner(f"Analyzing {num_leads} leads... This may take a few minutes."):
                    # Limit leads to the requested number
                    leads_to_analyze = all_leads[:num_leads]
                    
                    # Score the selected leads
                    scored_leads = lead_processor.ai_scorer.batch_score_leads(leads_to_analyze)
                    
                    # Calculate score distribution
                    score_distribution = {}
                    for lead in scored_leads:
                        score = lead.get('ai_score', 0)
                        score_distribution[score] = score_distribution.get(score, 0) + 1
                    
                    # Find high-scoring leads
                    high_score_leads = [lead for lead in scored_leads if lead.get('ai_score', 0) >= 5]
                
                st.success("✅ Analytics generated!")
                
                # Show summary metrics
                st.subheader("📊 Summary Metrics")
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    st.metric("Total Analyzed", len(scored_leads))
                
                with col2:
                    st.metric("High-Score Leads", len(high_score_leads))
                
                with col3:
                    high_score_percentage = (len(high_score_leads) / len(scored_leads) * 100) if scored_leads else 0
                    st.metric("High-Score %", f"{high_score_percentage:.1f}%")
                
                with col4:
                    avg_score = sum(lead.get('ai_score', 0) for lead in scored_leads) / len(scored_leads) if scored_leads else 0
                    st.metric("Average Score", f"{avg_score:.1f}")
                
                # Score distribution
                st.subheader("📊 Score Distribution")
                score_df = pd.DataFrame([
                    {"Score": score, "Count": count}
                    for score, count in sorted(score_distribution.items())
                ])
                st.bar_chart(score_df.set_index('Score'))
                
                # Score distribution table
                st.subheader("📋 Detailed Score Breakdown")
                st.dataframe(score_df, use_container_width=True)
                
                # Show ALL scored leads
                st.subheader("📋 All Scored Leads")
                all_scored_df = pd.DataFrame([
                    {
                        "ID": lead.get('id'),
                        "Name": lead.get('name'),
                        "Company": lead.get('company_name', ''),
                        "AI Score": lead.get('ai_score'),
                        "Scoring Reason": lead.get('ai_reason', 'No reason provided'),
                        "Pipeline": lead.get('pipeline', {}).get('name', ''),
                        "Status": lead.get('status', {}).get('name', '') if isinstance(lead.get('status'), dict) else 'Unknown',
                        "Price": lead.get('price', 0)
                    }
                    for lead in scored_leads
                ])
                st.dataframe(all_scored_df, use_container_width=True)
                
                # Show high-scoring leads separately
                if high_score_leads:
                    st.subheader("⭐ High-Scoring Leads (Score ≥ 5)")
                    high_score_df = pd.DataFrame([
                        {
                            "ID": lead.get('id'),
                            "Name": lead.get('name'),
                            "Company": lead.get('company_name', ''),
                            "AI Score": lead.get('ai_score'),
                            "Scoring Reason": lead.get('ai_reason', 'No reason provided'),
                            "Pipeline": lead.get('pipeline', {}).get('name', ''),
                            "Status": lead.get('status', {}).get('name', '') if isinstance(lead.get('status'), dict) else 'Unknown',
                            "Price": lead.get('price', 0)
                        }
                        for lead in high_score_leads
                    ])
                    st.dataframe(high_score_df, use_container_width=True)
                else:
                    st.info("No high-scoring leads found in the analyzed batch.")
                
                # Pipeline analysis
                st.subheader("📈 Pipeline Analysis")
                pipeline_analysis = {}
                for lead in scored_leads:
                    pipeline_name = lead.get('pipeline', {}).get('name', 'Unknown')
                    if pipeline_name not in pipeline_analysis:
                        pipeline_analysis[pipeline_name] = {'total': 0, 'high_score': 0, 'scores': []}
                    
                    pipeline_analysis[pipeline_name]['total'] += 1
                    pipeline_analysis[pipeline_name]['scores'].append(lead.get('ai_score', 0))
                    
                    if lead.get('ai_score', 0) >= 5:
                        pipeline_analysis[pipeline_name]['high_score'] += 1
                
                # Create pipeline analysis dataframe
                pipeline_df = pd.DataFrame([
                    {
                        "Pipeline": pipeline,
                        "Total Leads": data['total'],
                        "High-Score Leads": data['high_score'],
                        "High-Score %": (data['high_score'] / data['total'] * 100) if data['total'] > 0 else 0,
                        "Avg Score": sum(data['scores']) / len(data['scores']) if data['scores'] else 0
                    }
                    for pipeline, data in pipeline_analysis.items()
                ])
                st.dataframe(pipeline_df, use_container_width=True)
    
    except Exception as e:
        st.error(f"Error loading leads: {e}")

# Footer
st.markdown("---")
st.markdown("**Kommo Lead Scoring App** - Powered by AI 🤖")
