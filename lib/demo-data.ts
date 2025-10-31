import { Lead, Pipeline } from './kommo-client'

// Demo data for when API is not available
export const demoPipelines: Pipeline[] = [
  {
    id: 1,
    name: 'Sales Pipeline',
    statuses: [
      { id: 1, name: 'New Lead' },
      { id: 2, name: 'Qualified' },
      { id: 3, name: 'Proposal' },
      { id: 4, name: 'Negotiation' },
      { id: 5, name: 'Closed Won' }
    ]
  },
  {
    id: 2,
    name: 'Marketing Pipeline',
    statuses: [
      { id: 6, name: 'Lead' },
      { id: 7, name: 'MQL' },
      { id: 8, name: 'SQL' },
      { id: 9, name: 'Opportunity' }
    ]
  },
  {
    id: 3,
    name: 'Support Pipeline',
    statuses: [
      { id: 10, name: 'Inquiry' },
      { id: 11, name: 'In Progress' },
      { id: 12, name: 'Resolved' }
    ]
  }
]

export const demoLeads: Lead[] = [
  {
    id: 1,
    name: 'John Smith',
    company_name: 'Acme Corp',
    position: 'CEO',
    phone: [{ value: '+1-555-0123' }],
    email: [{ value: 'john@acme.com' }],
    pipeline: { id: 1, name: 'Sales Pipeline' },
    status: { id: 2, name: 'Qualified' },
    price: 50000,
    created_at: Date.now() / 1000 - 86400,
    updated_at: Date.now() / 1000 - 3600,
    responsible_user_id: 1,
    _embedded: {
      tags: [
        { name: 'VIP' },
        { name: 'Enterprise' }
      ]
    }
  },
  {
    id: 2,
    name: 'Sarah Johnson',
    company_name: 'TechStart Inc',
    position: 'CTO',
    phone: [{ value: '+1-555-0456' }],
    email: [{ value: 'sarah@techstart.com' }],
    pipeline: { id: 1, name: 'Sales Pipeline' },
    status: { id: 3, name: 'Proposal' },
    price: 25000,
    created_at: Date.now() / 1000 - 172800,
    updated_at: Date.now() / 1000 - 7200,
    responsible_user_id: 1,
    _embedded: {
      tags: [
        { name: 'Startup' },
        { name: 'High Priority' }
      ]
    }
  },
  {
    id: 3,
    name: 'Mike Wilson',
    company_name: 'Global Enterprises',
    position: 'VP Sales',
    phone: [{ value: '+1-555-0789' }],
    email: [{ value: 'mike@global.com' }],
    pipeline: { id: 2, name: 'Marketing Pipeline' },
    status: { id: 7, name: 'MQL' },
    price: 75000,
    created_at: Date.now() / 1000 - 259200,
    updated_at: Date.now() / 1000 - 10800,
    responsible_user_id: 2,
    _embedded: {
      tags: [
        { name: 'Enterprise' },
        { name: 'High Value' }
      ]
    }
  },
  {
    id: 4,
    name: 'Emily Davis',
    company_name: 'Small Business Co',
    position: 'Owner',
    phone: [{ value: '+1-555-0321' }],
    email: [{ value: 'emily@smallbiz.com' }],
    pipeline: { id: 1, name: 'Sales Pipeline' },
    status: { id: 1, name: 'New Lead' },
    price: 5000,
    created_at: Date.now() / 1000 - 345600,
    updated_at: Date.now() / 1000 - 14400,
    responsible_user_id: 1,
    _embedded: {
      tags: [
        { name: 'SMB' },
        { name: 'Local' }
      ]
    }
  },
  {
    id: 5,
    name: 'David Brown',
    company_name: 'Innovation Labs',
    position: 'Founder',
    phone: [{ value: '+1-555-0654' }],
    email: [{ value: 'david@innovation.com' }],
    pipeline: { id: 3, name: 'Support Pipeline' },
    status: { id: 10, name: 'Inquiry' },
    price: 15000,
    created_at: Date.now() / 1000 - 432000,
    updated_at: Date.now() / 1000 - 18000,
    responsible_user_id: 3,
    _embedded: {
      tags: [
        { name: 'Startup' },
        { name: 'Tech' }
      ]
    }
  }
]

export const getDemoData = () => ({
  pipelines: demoPipelines,
  leads: demoLeads
})
