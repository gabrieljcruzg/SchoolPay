'use client'

export function GroupSelect({
  groupId,
  groups,
  onChange,
}: {
  groupId: string
  groups: string[]
  onChange: (groupId: string) => void
}) {
  return (
    <select
      value={groupId}
      onChange={e => onChange(e.target.value)}
      className="bg-sp-bg3 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 outline-none focus:border-sp-gold/40"
      aria-label="Seleccionar grupo"
    >
      {groups.map(group => (
        <option key={group} value={group}>{group}</option>
      ))}
    </select>
  )
}
