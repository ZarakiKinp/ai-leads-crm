'use client'

import { useState } from 'react'
import { 
  Brain,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle,
  Star,
  FileText
} from 'lucide-react'
import LeadScoring from '@/components/LeadScoring'
import LeadMover from '@/components/LeadMover'
import PipelineMover from '@/components/PipelineMover'
import ScoredResults from '@/components/ScoredResults'

const navigation = [
  { name: 'Score Leads', icon: Brain, component: LeadScoring },
  { name: 'Scored Results', icon: FileText, component: ScoredResults },
  { name: 'Move Leads', icon: ArrowRight, component: LeadMover },
  { name: 'Pipeline Mover', icon: ArrowLeftRight, component: PipelineMover },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState('Score Leads')

  const ActiveComponent = navigation.find(nav => nav.name === activeTab)?.component || LeadScoring

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gradient">
                  🎯 Kommo Lead Scoring
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>AI Powered</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Smart Scoring</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
          <nav className="mt-8 px-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.name
                
                return (
                  <li key={item.name}>
                    <button
                      onClick={() => setActiveTab(item.name)}
                      className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors duration-200 ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mr-3 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                      <span className="font-medium">{item.name}</span>
                      {isActive && (
                        <ArrowRight className="h-4 w-4 ml-auto text-primary-600" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {activeTab}
              </h2>
              <p className="text-gray-600">
                {activeTab === 'Score Leads' && 'AI-powered lead scoring with detailed analysis and reasoning'}
                {activeTab === 'Move Leads' && 'Move leads to specific pipeline stages with user assignment'}
                {activeTab === 'Pipeline Mover' && 'Move leads between different pipelines and stages'}
              </p>
            </div>
            
            <div className="animate-fade-in">
              <ActiveComponent />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
