'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { User } from 'lucide-react'

const EMPTY = new Set(['', '-', 'n.a.', 'nil', 'none', 'not available'])
const blank = (v: string) => EMPTY.has(v?.toLowerCase().trim())

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-start gap-2 py-1 border-b border-blue-50 last:border-0">
      <span className="text-xs text-gray-500 min-w-[110px] flex-shrink-0">
        {label} :
      </span>
      <span className="text-xs font-medium text-slate-800 text-right">
        {value}
      </span>
    </div>
  )
}

function Card({
  title,
  children,
  accent,
}: {
  title?: string
  children: React.ReactNode
  accent?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {title && (
        <div
          className="px-3 py-2 font-bold text-[13px] text-slate-800 border-b border-blue-100"
          style={{ background: accent || '#eef3fb' }}
        >
          {title}
        </div>
      )}
      <div className="px-3 py-2">{children}</div>
    </div>
  )
}


export function PersonalMindMap({ data, mainPerson }: any) {
  const fields = useMemo(() => {
    const f: Record<string, string> = {}
    if (!data) return f
    Object.entries(data).forEach(([k, v]) => {
      if (!blank(v as string)) f[k] = v as string
    })
    return f
  }, [data])

  const get = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.entries(fields).find(([fk]) =>
        fk.toLowerCase().includes(k.toLowerCase())
      )
      if (found) return found[1]
    }
    return ''
  }

  const identityKeys = [
    'name','parentage','birth','nationality','marital',
    'descriptive','place of birth','religion','economic',
    'caste','tribe','sect','code'
  ]

  const identityRows = Object.entries(fields).filter(([k]) =>
    identityKeys.some(id => k.toLowerCase().includes(id))
  )

  const photo = get('photo', 'image')
  const typeValue = get('type')
  const mark = get('mark')
  const education = get('education')
  const address = get('address')
  const arrestedBy = get('arrested')
  const placeOfArrest = get('place of arrest')
  const expertise = get('expertise')
  const habits = get('habit')
  const occupation = get('occupation')

  return (
    <div className="bg-[#f4f7fb] min-h-screen p-6">
      <div className="max-w-[1100px] mx-auto grid grid-cols-[300px_1fr_1fr] gap-4">

        {/* LEFT PANEL */}
        <div className="space-y-4">
          <div className="bg-[#eef3fb] rounded-2xl shadow p-4">
            <h3 className="font-semibold text-sm mb-3">Personal Details</h3>
            {identityRows.map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs py-1 border-b last:border-0">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium text-right">{v}</span>
              </div>
            ))}
          </div>

          {mark && (
            <div className="bg-[#fdecec] rounded-2xl shadow p-4">
              <h3 className="text-red-500 font-semibold text-sm mb-2">
                Mark Of Identification
              </h3>
              <p className="text-sm">{mark}</p>
            </div>
          )}

          {education && (
            <div className="bg-[#eef3fb] rounded-2xl shadow p-4">
              <h3 className="font-semibold text-sm mb-2">
                Educational Qualification
              </h3>
              <p className="text-sm">{education}</p>
            </div>
          )}
        </div>

        {/* CENTER PANEL */}
        <div className="space-y-4">


          {/* PROFILE */}
          <div className="bg-white rounded-2xl shadow p-6 flex flex-col items-center text-center">
            <div className="w-28 h-28 rounded-full border-4 border-blue-300 overflow-hidden mb-3">
              {photo ? (
                <img src={photo} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200" />
              )}
            </div>

            <h2 className="font-semibold text-lg">
              {mainPerson || data?.name}
            </h2>

            {typeValue && (
              <div className="mt-2 px-4 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
                {typeValue}
              </div>
            )}
          </div>

          {address && (
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold text-sm mb-2">Address</h3>
              <p className="text-sm">{address}</p>
            </div>
          )}
 
          {arrestedBy && (
            <div className="bg-[#f3efff] rounded-2xl shadow p-4">
              <h3 className="font-semibold text-sm mb-2">Arrested By</h3>
              <p className="text-sm">{arrestedBy}</p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="space-y-4">

          {placeOfArrest && (
            <div className="bg-[#fff4e5] rounded-2xl shadow p-4">
              <h3 className="text-orange-500 font-semibold text-sm mb-2">
                Place Of Arrest
              </h3>
              <p className="text-sm">{placeOfArrest}</p>
            </div>
          )}

          {expertise && (
            <div className="bg-[#f3efff] rounded-2xl shadow p-4">
              <h3 className="text-purple-600 font-semibold text-sm mb-2">
                Expertise In Criminal Act
              </h3>
              <p className="text-sm">{expertise}</p>
            </div>
          )}

          {habits && (
            <div className="bg-[#eaf7f6] rounded-2xl shadow p-4">
              <h3 className="text-teal-600 font-semibold text-sm mb-2">
                Habits
              </h3>
              <p className="text-sm">{habits}</p>
            </div>
          )}

          {occupation && (
            <div className="bg-[#e8f7ef] rounded-2xl shadow p-4">
              <h3 className="text-green-600 font-semibold text-sm mb-2">
                Occupation Before Joining Crime
              </h3>
              <p className="text-sm">{occupation}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}