'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { useTranslation } from '@/lib/hooks/use-translation'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, Database, AlertCircle, RefreshCw } from 'lucide-react'

export default function AdvancedPage() {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const faqs = [
    { 
      q: "When should I rebuild embeddings?", 
      a: "You should rebuild embeddings whenever you make significant changes to your underlying data structure or if you notice a decrease in retrieval accuracy." 
    },
    { 
      q: "How long does the rebuild process take?", 
      a: "Depending on the size of your knowledge base, it can take anywhere from a few minutes to several hours." 
    },
    { 
      q: "Is it safe to use the app during rebuild?", 
      a: "Yes, the app remains fully functional. New queries will use the existing embeddings until the new ones are finalized." 
    },
    { 
      q: "What happens to my data during rebuild?", 
      a: "Your data remains untouched. The system simply generates new vector representations in the background." 
    }
  ]

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[linear-gradient(110deg,#dbeafe_0%,#f0f7fa_45%,#e5d5f2_100%)] relative overflow-hidden">
        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="NOTEBOOK"
        />

        <div className="flex-1 overflow-y-auto relative z-10">
          {/* Full width container using proper Tailwind responsive padding */}
          <div className="w-full px-4 sm:px-8 lg:px-12 py-8 lg:py-12 pb-24 space-y-8 text-left">
            
            <div className="space-y-2">
              <h1 className="text-3xl lg:text-4xl font-bold text-[#8A2BE2] tracking-tight">
                {t.advanced?.title || 'Advanced Tools'}
              </h1>
              <p className="text-sm sm:text-base text-slate-500 font-medium">
                {t.advanced?.desc || 'Advanced tools and utilities for power users'}
              </p>
            </div>

            {/* System Information Card */}
            <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8 lg:p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/30">
                  <Info className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">System Information</h2>
                  <p className="text-sm text-slate-500">Current version and system status overview</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="border border-slate-100 rounded-2xl p-6">
                  <p className="text-sm font-bold text-slate-500 mb-2">Current Version</p>
                  <p className="text-3xl font-bold text-slate-900">1.8.1</p>
                </div>
                <div className="border border-slate-100 rounded-2xl p-6">
                  <p className="text-sm font-bold text-slate-500 mb-2">Latest Version</p>
                  <p className="text-3xl font-bold text-slate-900">1.8.5</p>
                </div>
                <div className="border border-amber-200 bg-amber-50 rounded-2xl p-6">
                  <p className="text-sm font-bold text-slate-600 mb-3">Status</p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                    <p className="text-lg font-bold text-amber-600">Update Available</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rebuild Embeddings Card */}
            <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8 lg:p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-[#8A2BE2] flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-500/30">
                  <Database className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Rebuild Embeddings</h2>
                  <p className="text-sm text-slate-500">Regenerate all vector embeddings for your knowledge base</p>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-8 flex gap-4 items-start">
                 <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                 <div>
                   <h4 className="text-sm font-bold text-orange-700 mb-1">Important Notice</h4>
                   <p className="text-sm text-orange-700/80 leading-relaxed">
                     This process will rebuild all embeddings in your knowledge base. Depending on the size of your data, this may take several minutes to hours. Your app will remain functional during this time.
                   </p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-slate-700">Rebuild Mode</label>
                  <select className="w-full h-12 px-4 bg-purple-50 border border-purple-100 rounded-xl text-sm text-purple-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]/30 cursor-pointer appearance-none">
                    <option>Full Rebuild</option>
                  </select>
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-slate-700">Priority</label>
                  <select className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]/30 cursor-pointer appearance-none">
                    <option>Normal</option>
                  </select>
                </div>
                <div className="space-y-2.5">
                  <label className="text-sm font-bold text-slate-700">Scope</label>
                  <select className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]/30 cursor-pointer appearance-none">
                    <option>All Documents</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                <div className="flex justify-between text-sm font-bold text-slate-700 mb-3">
                  <span>Progress</span>
                  <span>0%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full mb-3 overflow-hidden">
                  <div className="h-full bg-[#8A2BE2] rounded-full w-0"></div>
                </div>
                <p className="text-xs text-slate-500 font-medium">Ready to start rebuild process</p>
              </div>

              <button className="w-full h-14 bg-[#8A2BE2] hover:bg-purple-700 text-white text-base font-bold rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg shadow-[#8A2BE2]/25">
                <RefreshCw className="w-5 h-5" />
                Start Rebuild Process
              </button>
            </div>

            {/* Responsive FAQ Section */}
            <div className="space-y-5 pt-4">
              <h3 className="text-lg font-bold text-slate-800 px-1">Frequently Asked Questions</h3>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden transition-all duration-200 hover:border-purple-200">
                    <button 
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full p-5 sm:p-6 flex justify-between items-center text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-purple-50 rounded-xl text-[#8A2BE2] shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-sm sm:text-base font-bold text-slate-700">{faq.q}</span>
                      </div>
                      <motion.svg 
                        animate={{ rotate: openFaq === i ? 90 : 0 }}
                        className="w-5 h-5 text-slate-400 shrink-0" 
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </motion.svg>
                    </button>
                    
                    <AnimatePresence>
                      {openFaq === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-5 sm:px-[72px] pb-6 text-sm text-slate-500 leading-relaxed"
                        >
                          <div className="pt-2 border-t border-slate-100">
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </AppShell>
  )
}