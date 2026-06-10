'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sourcesApi } from '@/lib/api/sources'
import { SourceListResponse } from '@/lib/types/api'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { 
  FileText, 
  Trash2, 
  LayoutGrid, 
  List, 
  Search, 
  Filter,
  ChevronDown,
  Database
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/notifications/toast'
import { getApiErrorKey } from '@/lib/utils/error-handler'

interface SourceListItem {
  id: string
  title: string
  type: string
  size: string
  uploadedBy: string
  uploadedDate: string
  caseCode: string
  status: 'Processed' | 'Processing'
  created: string
  embedded: boolean
  isMock?: boolean
}

const mockSourcesList: SourceListItem[] = [
  {
    id: 'mock:1',
    title: 'Evidence Report Q2 2026.pdf',
    type: 'PDF',
    size: '2.4 MB',
    uploadedBy: 'Sarah Johnson',
    uploadedDate: 'Jun 15, 2026',
    caseCode: 'INV-2847',
    status: 'Processed',
    created: '2026-06-15T10:00:00Z',
    embedded: true,
    isMock: true
  },
  {
    id: 'mock:2',
    title: 'Financial Records 2025.xlsx',
    type: 'Excel',
    size: '1.8 MB',
    uploadedBy: 'Mike Chen',
    uploadedDate: 'Jun 14, 2026',
    caseCode: 'INV-2847',
    status: 'Processed',
    created: '2026-06-14T10:00:00Z',
    embedded: true,
    isMock: true
  },
  {
    id: 'mock:3',
    title: 'Surveillance Footage.mp4',
    type: 'Video',
    size: '156 MB',
    uploadedBy: 'Emily Rodriguez',
    uploadedDate: 'Jun 13, 2026',
    caseCode: 'INV-2846',
    status: 'Processing',
    created: '2026-06-13T10:00:00Z',
    embedded: false,
    isMock: true
  },
  {
    id: 'mock:4',
    title: 'Interview Transcript.docx',
    type: 'Word',
    size: '845 KB',
    uploadedBy: 'David Kim',
    uploadedDate: 'Jun 12, 2026',
    caseCode: 'INV-2845',
    status: 'Processed',
    created: '2026-06-12T10:00:00Z',
    embedded: true,
    isMock: true
  },
  {
    id: 'mock:5',
    title: 'Crime Scene Photos.zip',
    type: 'Archive',
    size: '45 MB',
    uploadedBy: 'Lisa Thompson',
    uploadedDate: 'Jun 11, 2026',
    caseCode: 'INV-2844',
    status: 'Processed',
    created: '2026-06-11T10:00:00Z',
    embedded: true,
    isMock: true
  },
  {
    id: 'mock:6',
    title: 'Audit Report 2026.pdf',
    type: 'PDF',
    size: '3.2 MB',
    uploadedBy: 'James Wilson',
    uploadedDate: 'Jun 10, 2026',
    caseCode: 'INV-2845',
    status: 'Processed',
    created: '2026-06-10T10:00:00Z',
    embedded: true,
    isMock: true
  },
  {
    id: 'mock:7',
    title: 'Witness Statement.pdf',
    type: 'PDF',
    size: '1.1 MB',
    uploadedBy: 'Maria Garcia',
    uploadedDate: 'Jun 9, 2026',
    caseCode: 'INV-2843',
    status: 'Processed',
    created: '2026-06-09T10:00:00Z',
    embedded: true,
    isMock: true
  },
  {
    id: 'mock:8',
    title: 'Bank Records.csv',
    type: 'CSV',
    size: '524 KB',
    uploadedBy: 'Robert Brown',
    uploadedDate: 'Jun 8, 2026',
    caseCode: 'INV-2847',
    status: 'Processed',
    created: '2026-06-08T10:00:00Z',
    embedded: true,
    isMock: true
  }
]

const generateMockSources = (): SourceListItem[] => {
  const list = [...mockSourcesList]
  const fileNames = [
    'Incident_Report_A.pdf', 'Q3_Financials_Draft.xlsx', 'CCTV_Camera_4_Main_Gate.mp4',
    'Witness_Interview_Transcription.docx', 'Archive_Backup_2026.zip', 'Audit_Trail_Log.csv',
    'Forensic_Image_Scan.png', 'Audio_Call_Recording.mp3'
  ]
  const types = ['PDF', 'Excel', 'Video', 'Word', 'Archive', 'CSV', 'Image', 'Audio']
  const sizes = ['3.4 MB', '2.1 MB', '245 MB', '1.2 MB', '120 MB', '820 KB', '4.5 MB', '12.4 MB']
  const names = ['Sarah Johnson', 'Mike Chen', 'Emily Rodriguez', 'David Kim', 'Lisa Thompson', 'James Wilson', 'Maria Garcia', 'Robert Brown']
  const cases = ['INV-2847', 'INV-2846', 'INV-2845', 'INV-2844', 'INV-2843']
  
  for (let i = 9; i <= 40; i++) {
    const idx = i % fileNames.length
    const type = types[idx]
    const size = sizes[idx]
    const uploadedBy = names[(i + 2) % names.length]
    const caseCode = cases[i % cases.length]
    const isProcessed = i % 7 !== 0
    
    const d = new Date()
    d.setDate(d.getDate() - (i % 15))
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const uploadedDate = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    
    list.push({
      id: `mock:${i}`,
      title: fileNames[idx].replace('_', ' ').replace('Report A', `Report Q${i%4+1}`).replace('2026', String(2026 - (i%2))),
      type,
      size,
      uploadedBy,
      uploadedDate,
      caseCode,
      status: isProcessed ? 'Processed' : 'Processing',
      created: d.toISOString(),
      embedded: isProcessed,
      isMock: true
    })
  }
  return list
}

const mapSourceToListItem = (source: SourceListResponse): SourceListItem => {
  const ext = source.title?.split('.').pop()?.toLowerCase() || ''
  let type = 'Unknown'
  if (['pdf'].includes(ext)) type = 'PDF'
  else if (['xlsx', 'xls'].includes(ext)) type = 'Excel'
  else if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) type = 'Video'
  else if (['docx', 'doc'].includes(ext)) type = 'Word'
  else if (['zip', 'rar', 'tar', 'gz'].includes(ext)) type = 'Archive'
  else if (['csv'].includes(ext)) type = 'CSV'
  else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) type = 'Image'
  else if (['mp3', 'wav', 'ogg'].includes(ext)) type = 'Audio'

  let uploadedDate = 'Unknown'
  try {
    const d = new Date(source.created)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    uploadedDate = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  } catch (e) {}

  return {
    id: source.id,
    title: source.title || 'Untitled Document',
    type,
    size: '2.4 MB',
    uploadedBy: 'Super Admin',
    uploadedDate,
    caseCode: 'INV-2847',
    status: source.embedded ? 'Processed' : 'Processing',
    created: source.created,
    embedded: source.embedded,
    isMock: false
  }
}

const getFileIconBg = (type: string) => {
  const t = type.toLowerCase()
  if (t === 'pdf') return 'bg-rose-50 border border-rose-100'
  if (t === 'excel' || t === 'csv') return 'bg-emerald-50 border border-emerald-100'
  if (t === 'video') return 'bg-blue-50 border border-blue-100'
  if (t === 'word') return 'bg-indigo-50 border border-indigo-100'
  if (t === 'archive') return 'bg-amber-50 border border-amber-100'
  return 'bg-slate-50 border border-slate-100'
}

const getFileIconColor = (type: string) => {
  const t = type.toLowerCase()
  if (t === 'pdf') return 'text-rose-600'
  if (t === 'excel' || t === 'csv') return 'text-emerald-600'
  if (t === 'video') return 'text-blue-600'
  if (t === 'word') return 'text-indigo-600'
  if (t === 'archive') return 'text-amber-600'
  return 'text-slate-600'
}

export default function SourcesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [sources, setSources] = useState<SourceListResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  
  const [deleteDialog, setDeleteDialog] = useState<{ 
    open: boolean; 
    source: SourceListResponse | null;
    mockSourceId?: string | null;
  }>({
    open: false,
    source: null,
    mockSourceId: null
  })

  // List View Specific States
  const [localListItems, setLocalListItems] = useState<SourceListItem[]>(() => generateMockSources())
  const [listSearchTerm, setListSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('All Types')
  const [selectedStatus, setSelectedStatus] = useState('All Status')
  const [listPage, setListPage] = useState(1)
  const itemsPerPage = 8
  
  const offsetRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const PAGE_SIZE = 30

  const [sortBy] = useState<'created' | 'updated'>('updated')
  const [sortOrder] = useState<'asc' | 'desc'>('desc')

  // Synchronize real sources with local list items
  useEffect(() => {
    const mappedReal = sources.map(mapSourceToListItem)
    setLocalListItems(prev => {
      const remainingMocks = prev.filter(item => item.isMock)
      const realTitles = new Set(mappedReal.map(r => r.title.toLowerCase()))
      const filteredMocks = remainingMocks.filter(m => !realTitles.has(m.title.toLowerCase()))
      return [...mappedReal, ...filteredMocks]
    })
  }, [sources])

  // --- Logic Preserved ---
  const fetchSources = useCallback(async (reset = false) => {
    try {
      if (!reset && (loadingMoreRef.current || !hasMoreRef.current)) return
      if (reset) {
        setLoading(true)
        offsetRef.current = 0
        setSources([])
        hasMoreRef.current = true
      } else {
        loadingMoreRef.current = true
        setLoadingMore(true)
      }

      const data = await sourcesApi.list({
        limit: PAGE_SIZE,
        offset: offsetRef.current,
        sort_by: sortBy,
        sort_order: sortOrder,
      })

      if (reset) setSources(data)
      else setSources(prev => [...prev, ...data])

      hasMoreRef.current = data.length === PAGE_SIZE
      offsetRef.current += data.length
    } catch (err) {
      setError(t.sources.failedToLoad)
      toast.error(t.sources.failedToLoad)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [sortBy, sortOrder, t.sources.failedToLoad])

  useEffect(() => { fetchSources(true) }, [fetchSources])

  const handleDeleteConfirm = async () => {
    if (deleteDialog.mockSourceId) {
      setLocalListItems(prev => prev.filter(item => item.id !== deleteDialog.mockSourceId))
      toast.success(t.sources.deleteSuccess)
      setDeleteDialog({ open: false, source: null, mockSourceId: null })
      return
    }
    if (!deleteDialog.source) return
    try {
      await sourcesApi.delete(deleteDialog.source.id)
      toast.success(t.sources.deleteSuccess)
      setSources(prev => prev.filter(s => s.id !== deleteDialog.source?.id))
      setDeleteDialog({ open: false, source: null, mockSourceId: null })
    } catch (err: any) {
      toast.error(t(getApiErrorKey(err.response?.data?.detail || err.message)))
    }
  }

  const handleDeleteClick = (item: SourceListItem) => {
    if (item.isMock) {
      setDeleteDialog({
        open: true,
        source: null,
        mockSourceId: item.id
      })
    } else {
      const original = sources.find(s => s.id === item.id)
      if (original) {
        setDeleteDialog({
          open: true,
          source: original,
          mockSourceId: null
        })
      }
    }
  }

  // Filter logic for search
  const filteredSources = sources.filter(source => 
    source.title?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // List View filtering logic
  const filteredListItems = localListItems.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
      item.caseCode.toLowerCase().includes(listSearchTerm.toLowerCase()) ||
      item.uploadedBy.toLowerCase().includes(listSearchTerm.toLowerCase())
      
    const matchesType = selectedType === 'All Types' || item.type.toLowerCase() === selectedType.toLowerCase()
    const matchesStatus = selectedStatus === 'All Status' || item.status.toLowerCase() === selectedStatus.toLowerCase()
    
    return matchesSearch && matchesType && matchesStatus
  })

  // List View pagination calculation
  const totalPages = Math.ceil(filteredListItems.length / itemsPerPage)
  const paginatedListItems = filteredListItems.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage)

  // Navigate to the source detail / chat page
  const handleSourceClick = (sourceId: string) => {
    if (sourceId.startsWith('mock:')) {
      toast.info('Viewing details of mock file: ' + sourceId)
      return
    }
    const shortId = sourceId.includes(':') ? sourceId.split(':')[1] : sourceId
    router.push(`/sources/${shortId}`)
  }

  if (loading) return <AppShell><div className="flex h-full items-center justify-center bg-[#F9FAFF]"><LoadingSpinner /></div></AppShell>
  if (error) return <AppShell><div className="flex h-full items-center justify-center text-red-500 bg-[#F9FAFF]">{error}</div></AppShell>

  return (
    <AppShell>
      <div className="flex flex-col w-full h-full bg-[#F9FAFF] relative overflow-hidden">
        {/* Background Gradient Effect - Exact match to shared reference */}
        <div className="absolute top-0 right-[-10%] w-[800px] h-[800px] bg-[#E0D7FF]/50 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#D7E4FF]/40 rounded-full blur-[100px] pointer-events-none" />

        <PageHeader
          searchValue={viewMode === 'list' ? listSearchTerm : searchTerm}
          onSearchChange={viewMode === 'list' ? (val) => { setListSearchTerm(val); setListPage(1); } : setSearchTerm}
          searchPlaceholder="Search sources..."
          newLabel="i_Notes"
        />

        <main className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar text-slate-800">
          {viewMode === 'list' ? (
            /* --- REDESIGNED LIST VIEW LAYOUT --- */
            <div className="space-y-6">
              
              {/* Header Title Section */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-650 border border-indigo-100 shadow-sm shrink-0">
                    <Database className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <h1 className="text-[20px] font-bold text-slate-800 leading-tight">Sources</h1>
                    <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Manage all documents and evidence files</p>
                  </div>
                </div>

                {/* View Toggle */}
                <div className="bg-white/70 backdrop-blur-md border border-white shadow-xs rounded-xl p-1.5 flex items-center gap-1 self-start">
                  <div className="flex items-center gap-1 bg-slate-100/50 rounded-lg p-0.5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-md transition-all bg-white shadow-xs text-indigo-600"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-md transition-all text-slate-400"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* KPI Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Total Files */}
                <div className="bg-white rounded-[16px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col gap-2.5 text-left group hover:shadow-md transition-all duration-300">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Files</span>
                  <h3 className="text-[28px] font-extrabold text-slate-800 leading-none">
                    {Number(3547 + (localListItems.length - 40)).toLocaleString()}
                  </h3>
                  <span className="text-[12px] font-bold text-emerald-500 flex items-center gap-1">
                    <span className="text-[10px]">▲</span> +18.2%
                  </span>
                </div>

                {/* Card 2: Total Storage */}
                <div className="bg-white rounded-[16px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col gap-2.5 text-left group hover:shadow-md transition-all duration-300">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Storage</span>
                  <h3 className="text-[28px] font-extrabold text-slate-800 leading-none">2.4 TB</h3>
                  <span className="text-[12px] font-bold text-blue-500">65% capacity</span>
                </div>

                {/* Card 3: Uploaded Today */}
                <div className="bg-white rounded-[16px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col gap-2.5 text-left group hover:shadow-md transition-all duration-300">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Uploaded Today</span>
                  <h3 className="text-[28px] font-extrabold text-slate-800 leading-none">156</h3>
                  <span className="text-[12px] font-bold text-emerald-500">+24 from yesterday</span>
                </div>

                {/* Card 4: Processing */}
                <div className="bg-white rounded-[16px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col gap-2.5 text-left group hover:shadow-md transition-all duration-300">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Processing</span>
                  <h3 className="text-[28px] font-extrabold text-slate-800 leading-none">
                    {Math.max(0, 12 + localListItems.filter(item => item.status === 'Processing').length - 5)}
                  </h3>
                  <span className="text-[12px] font-bold text-amber-500">AI analysis in progress</span>
                </div>
              </div>

              {/* Table & Filters Card */}
              <div className="bg-white rounded-[20px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 space-y-6">
                
                {/* Search & Filter Row */}
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full lg:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search files by name, type, or case..."
                      value={listSearchTerm}
                      onChange={(e) => { setListSearchTerm(e.target.value); setListPage(1); }}
                      className="w-full h-11 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-left"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
                    {/* Type Select */}
                    <div className="relative min-w-[130px]">
                      <select
                        value={selectedType}
                        onChange={(e) => { setSelectedType(e.target.value); setListPage(1); }}
                        className="w-full h-11 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-left"
                      >
                        <option value="All Types">All Types</option>
                        <option value="PDF">PDF</option>
                        <option value="Excel">Excel</option>
                        <option value="Video">Video</option>
                        <option value="Word">Word</option>
                        <option value="Archive">Archive</option>
                        <option value="CSV">CSV</option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Status Select */}
                    <div className="relative min-w-[130px]">
                      <select
                        value={selectedStatus}
                        onChange={(e) => { setSelectedStatus(e.target.value); setListPage(1); }}
                        className="w-full h-11 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-left"
                      >
                        <option value="All Status">All Status</option>
                        <option value="Processed">Processed</option>
                        <option value="Processing">Processing</option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Filters Button */}
                    <button className="h-11 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer bg-white">
                      <Filter className="w-4 h-4 text-slate-400" />
                      <span>Filters</span>
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-4 font-semibold pl-2">File Name</th>
                        <th className="pb-4 font-semibold">Type</th>
                        <th className="pb-4 font-semibold">Size</th>
                        <th className="pb-4 font-semibold">Uploaded By</th>
                        <th className="pb-4 font-semibold">Upload Date</th>
                        <th className="pb-4 font-semibold">Case</th>
                        <th className="pb-4 font-semibold">Status</th>
                        <th className="pb-4 font-semibold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedListItems.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/30 transition-colors cursor-pointer"
                          onClick={() => handleSourceClick(item.id)}
                        >
                          <td className="py-3.5 pl-2 text-left">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[13px] shadow-xs shrink-0",
                                getFileIconBg(item.type)
                              )}>
                                <FileText className={cn("h-4.5 w-4.5", getFileIconColor(item.type))} />
                              </div>
                              <span className="text-[14px] font-bold text-slate-800 truncate max-w-[280px]">{item.title}</span>
                            </div>
                          </td>
                          <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">{item.type}</td>
                          <td className="py-3.5 text-[13px] font-bold text-slate-600 text-left">{item.size}</td>
                          <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">{item.uploadedBy}</td>
                          <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">{item.uploadedDate}</td>
                          <td className="py-3.5 text-left">
                            <span className="text-[13px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer">
                              {item.caseCode}
                            </span>
                          </td>
                          <td className="py-3.5 text-left">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold",
                              item.status === 'Processed'
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                : "bg-amber-50 text-amber-600 border-amber-100"
                            )}>
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                item.status === 'Processed' ? "bg-emerald-500" : "bg-amber-500"
                              )} />
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3.5 text-center">
                            <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleSourceClick(item.id)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold text-[13px] hover:underline cursor-pointer"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleDeleteClick(item)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Pagination */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-[12px] text-slate-400 font-bold">
                    Showing {(listPage - 1) * itemsPerPage + 1} to {Math.min(listPage * itemsPerPage, filteredListItems.length)} of {filteredListItems.length} files
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={listPage === 1}
                        onClick={() => setListPage(prev => Math.max(prev - 1, 1))}
                        className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                        const isActive = page === listPage
                        return (
                          <button
                            key={page}
                            onClick={() => setListPage(page)}
                            className={cn(
                              "w-8 h-8 rounded-lg text-[12px] font-bold border flex items-center justify-center cursor-pointer transition-colors",
                              isActive 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-xs" 
                                : "border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            {page}
                          </button>
                        )
                      })}
                      <button
                        disabled={listPage === totalPages}
                        onClick={() => setListPage(prev => Math.min(prev + 1, totalPages))}
                        className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            /* --- ORIGINAL GRID VIEW --- */
            <>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 sm:mb-8">
                <div>
                  <h1 className="text-3xl font-extrabold text-[#6334E3] tracking-tight">All Sources</h1>
                  <p className="text-slate-500 text-sm font-medium mt-1">
                    Manage your document library and knowledge base sources
                  </p>
                </div>
                
                <div className="bg-white/70 backdrop-blur-md border border-white shadow-xs rounded-xl p-1.5 flex items-center gap-2 self-start">
                  <Button variant="ghost" size="sm" className="text-slate-500 gap-2 h-8 font-semibold">
                    <Filter className="h-4 w-4" />
                    Filter
                  </Button>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <div className="flex items-center gap-1 bg-slate-100/50 rounded-lg p-0.5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-md transition-all text-slate-400"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 rounded-md transition-all bg-white shadow-xs text-[#6334E3]"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Grid Layout of files */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                {filteredSources.map((source) => (
                  <div
                    key={source.id}
                    className="bg-white rounded-[24px] border border-white/50 shadow-xl shadow-slate-200/40 p-5 flex flex-col hover:scale-[1.01] transition-transform duration-300 cursor-pointer"
                    onClick={() => handleSourceClick(source.id)}
                  >
                    {/* Card Icon Container */}
                    <div className="aspect-[16/9] bg-[#F1EEFF] rounded-[20px] flex items-center justify-center mb-5 relative group">
                      <FileText className="h-14 w-14 text-[#6334E3]" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, source }); }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Document Info */}
                    <div className="px-1">
                      <h3 className="font-bold text-slate-800 text-sm mb-2 truncate">
                        {source.title || "Untitled Document"}
                      </h3>
                      
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-4">
                        <span>2.4 MB</span>
                        <span>12 pages</span>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          source.embedded ? "bg-emerald-400" : "bg-amber-400"
                        )} />
                        <span className={cn(
                          "text-[11px] font-bold",
                          source.embedded ? "text-emerald-500" : "text-amber-500"
                        )}>
                          {source.embedded ? 'Embedded' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredSources.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">No sources found</h3>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, source: deleteDialog.source, mockSourceId: deleteDialog.mockSourceId })}
        title={t.sources.delete}
        description={deleteDialog.mockSourceId 
          ? t.sources.deleteConfirmWithTitle.replace('{title}', localListItems.find(item => item.id === deleteDialog.mockSourceId)?.title || '')
          : t.sources.deleteConfirmWithTitle.replace('{title}', deleteDialog.source?.title || t.sources.untitledSource)}
        confirmText={t.common.delete}
        confirmVariant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </AppShell>
  )
}
