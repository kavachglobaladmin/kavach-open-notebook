'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { RebuildEmbeddings } from './components/RebuildEmbeddings'
import { SystemInfo } from './components/SystemInfo'
import { useTranslation } from '@/lib/hooks/use-translation'
import { motion, AnimatePresence } from 'framer-motion'

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
      <div className="flex-1 flex flex-col min-h-0 bg-[#fbfaff] relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-[-5%] right-[-5%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-purple-200/40 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[5%] left-[-5%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-indigo-100/50 rounded-full blur-[70px] md:blur-[100px] pointer-events-none" />

        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="NOTEBOOK"
        />

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8">
            
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold text-[#5e41d8]">{t.advanced.title}</h1>
              <p className="text-slate-500 text-xs md:text-sm font-medium">{t.advanced.desc}</p>
            </div>

            <SystemInfo />
            <RebuildEmbeddings />

            {/* Responsive FAQ Section */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 px-1">Frequently Asked Questions</h3>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl overflow-hidden transition-all duration-200 hover:border-indigo-200">
                    <button 
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full p-4 md:p-5 flex justify-between items-center text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-indigo-500/10 rounded-full text-indigo-500 shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-sm font-bold text-slate-700">{faq.q}</span>
                      </div>
                      <motion.svg 
                        animate={{ rotate: openFaq === i ? 90 : 0 }}
                        className="w-4 h-4 text-slate-400 shrink-0" 
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
                          className="px-4 pb-5 md:px-5 md:pb-6 text-xs md:text-sm text-slate-500 leading-relaxed"
                        >
                          <div className="pt-2 border-t border-slate-50">
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