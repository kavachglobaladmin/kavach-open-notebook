'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCreatei_Notes } from '@/lib/hooks/use-i_Notes'
import { FileText, Calendar, Tag, ChevronDown, Info } from 'lucide-react'

const createi_Noteschema = z.object({
  name: z.string().min(1, 'Case name is required'),
  description: z.string().min(1, 'Description is required'),
  caseType: z.string().optional(),
  priority: z.string().optional(),
  assignee: z.string().optional(),
  team: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.string().optional(),
})

type Createi_NotesFormData = z.infer<typeof createi_Noteschema>

interface Createi_NotesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function Createi_NotesDialog({ open, onOpenChange }: Createi_NotesDialogProps) {
  const createi_Notes = useCreatei_Notes()

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<Createi_NotesFormData>({
    resolver: zodResolver(createi_Noteschema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      caseType: '',
      priority: '',
      assignee: '',
      team: '',
      dueDate: '',
      tags: '',
    },
  })

  const closeDialog = () => onOpenChange(false)

  const onSubmit = async (data: Createi_NotesFormData) => {
    await createi_Notes.mutateAsync({
      name: data.name,
      description: data.description,
      storage_limit_mb: 5, // Default storage limit
      content: ''
    })
    closeDialog()
    reset()
  }

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] rounded-xl p-6 md:p-8 border-none shadow-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left space-y-1">
          <DialogTitle className="text-[22px] font-bold text-slate-900 leading-tight">
            Create New Case
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-[13px] font-medium">
            Fill in the details to create a new investigation case
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
          {/* ── Case Information Section ── */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Case Information
            </h3>

            {/* Case Name */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="case-name" className="text-[13px] font-semibold text-slate-800">
                Case Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="case-name"
                  {...register('name')}
                  placeholder="Enter case name"
                  className="pl-10 h-11 rounded-md border border-slate-200 bg-[#F8FAFC] focus-visible:bg-white focus-visible:ring-[#00B074]/20 focus-visible:border-[#00B074] transition-all"
                  autoComplete="off"
                />
              </div>
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Case Type & Priority Level */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="case-type" className="text-[13px] font-semibold text-slate-800">
                  Case Type <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    id="case-type"
                    {...register('caseType')}
                    className="h-11 w-full rounded-md border border-slate-200 bg-[#F8FAFC] pl-3.5 pr-10 text-[14px] text-slate-700 outline-none focus:bg-white focus:border-[#00B074] focus:ring-1 focus:ring-[#00B074] transition-all cursor-pointer appearance-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select case type</option>
                    <option value="Fraud Investigation">Fraud Investigation</option>
                    <option value="Data Breach">Data Breach</option>
                    <option value="Compliance Audit">Compliance Audit</option>
                    <option value="Internal Investigation">Internal Investigation</option>
                    <option value="Employee Background Check">Employee Background Check</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-[13px] font-semibold text-slate-800">
                  Priority Level <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    id="priority"
                    {...register('priority')}
                    className="h-11 w-full rounded-md border border-slate-200 bg-[#F8FAFC] pl-3.5 pr-10 text-[14px] text-slate-700 outline-none focus:bg-white focus:border-[#00B074] focus:ring-1 focus:ring-[#00B074] transition-all cursor-pointer appearance-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select priority</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5 text-left">
              <Label htmlFor="description" className="text-[13px] font-semibold text-slate-800">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Enter detailed case description"
                rows={3}
                className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3.5 focus-visible:bg-white focus-visible:ring-[#00B074]/20 focus-visible:border-[#00B074] transition-all resize-none text-[14px]"
              />
              {errors.description && (
                <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
              )}
            </div>
          </div>

          {/* ── Assignment & Timeline Section ── */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Assignment & Timeline
            </h3>

            {/* Assignee & Team */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="assignee" className="text-[13px] font-semibold text-slate-800">
                  Assignee <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    id="assignee"
                    {...register('assignee')}
                    className="h-11 w-full rounded-md border border-slate-200 bg-[#F8FAFC] pl-3.5 pr-10 text-[14px] text-slate-700 outline-none focus:bg-white focus:border-[#00B074] focus:ring-1 focus:ring-[#00B074] transition-all cursor-pointer appearance-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select assignee</option>
                    <option value="Sarah Johnson">Sarah Johnson</option>
                    <option value="Mike Chen">Mike Chen</option>
                    <option value="Emily Rodriguez">Emily Rodriguez</option>
                    <option value="David Kim">David Kim</option>
                    <option value="Lisa Thompson">Lisa Thompson</option>
                    <option value="James Wilson">James Wilson</option>
                    <option value="Maria Garcia">Maria Garcia</option>
                    <option value="Robert Brown">Robert Brown</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="team" className="text-[13px] font-semibold text-slate-800">
                  Team <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <select
                    id="team"
                    {...register('team')}
                    className="h-11 w-full rounded-md border border-slate-200 bg-[#F8FAFC] pl-3.5 pr-10 text-[14px] text-slate-700 outline-none focus:bg-white focus:border-[#00B074] focus:ring-1 focus:ring-[#00B074] transition-all cursor-pointer appearance-none"
                    defaultValue=""
                  >
                    <option value="" disabled>Select team</option>
                    <option value="Finance Team">Finance Team</option>
                    <option value="Cyber Crime">Cyber Crime</option>
                    <option value="Operations">Operations</option>
                    <option value="Investigation">Investigation</option>
                    <option value="HR Team">HR Team</option>
                    <option value="Legal">Legal</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Due Date & Tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="due-date" className="text-[13px] font-semibold text-slate-800">
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="due-date"
                    type="date"
                    {...register('dueDate')}
                    className="pl-10 h-11 rounded-md border border-slate-200 bg-[#F8FAFC] focus-visible:bg-white focus-visible:ring-[#00B074]/20 focus-visible:border-[#00B074] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tags" className="text-[13px] font-semibold text-slate-800">
                  Tags
                </Label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="tags"
                    {...register('tags')}
                    placeholder="Add tags (comma separated)"
                    className="pl-10 h-11 rounded-md border border-slate-200 bg-[#F8FAFC] focus-visible:bg-white focus-visible:ring-[#00B074]/20 focus-visible:border-[#00B074] transition-all"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Alert Box Info Banner */}
          <div className="bg-[#EAFBF3] border border-[#00B074]/20 rounded-md p-4 flex gap-3 text-left items-start">
            <Info className="w-5 h-5 text-[#00B074] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[13px] font-bold text-slate-800 leading-none">Case Creation</h4>
              <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                The assigned user will be notified via email and the case will appear in their dashboard immediately.
              </p>
            </div>
          </div>

          {/* Dialog Footer Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={closeDialog}
              className="px-5 h-11 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-[14px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || createi_Notes.isPending}
              className="px-6 h-11 rounded-md bg-[#00B074] hover:bg-[#009662] text-white font-bold text-[14px] shadow-sm transition-all border-none"
            >
              {createi_Notes.isPending ? 'Creating...' : 'Create Case'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
