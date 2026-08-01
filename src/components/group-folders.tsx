// Shared "group folder" UI used by Harvests, Loans and Labour Records.
// Folders are created automatically from Work Attendance groups — the farmer
// never creates a group anywhere else.

export interface GroupFolder {
  id: number | null; // null = "General" (records without a group)
  name: string;
  subtitle: string;
  count: number;
  emoji: string;
  iconBg: string;
}

// Builds the group list for a page: all active work groups, plus any group id
// referenced by existing records whose group is inactive/missing (so no record
// is ever unreachable).
export function buildGroupIds(
  workGroups: { id: number; name: string; isActive?: boolean }[],
  records: { workGroupId?: number | null }[],
): { id: number; name: string }[] {
  const active = workGroups.filter((g) => g.isActive !== false);
  const known = new Set(active.map((g) => g.id));
  const nameById = new Map(workGroups.map((g) => [g.id, g.name]));
  const orphans: number[] = [];
  for (const r of records) {
    if (r.workGroupId != null && !known.has(r.workGroupId) && !orphans.includes(r.workGroupId)) {
      orphans.push(r.workGroupId);
    }
  }
  return [
    ...active.map((g) => ({ id: g.id, name: g.name })),
    ...orphans.map((id) => ({ id, name: nameById.get(id) ?? `Group #${id}` })),
  ];
}

export function GroupFolderList({
  folders,
  onOpen,
  emptyHint,
}: {
  folders: GroupFolder[];
  onOpen: (f: GroupFolder) => void;
  emptyHint?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase">👥 Your work groups</p>
      {folders.filter((f) => f.id != null).length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
          <p className="text-sm text-gray-500">No work groups yet</p>
          <p className="text-xs text-gray-400 mt-1">
            {emptyHint ?? "Create a group in Work Attendance — it will appear here automatically"}
          </p>
        </div>
      )}
      <div className="space-y-2">
        {folders.map((f) => (
          <button
            key={f.id ?? "general"}
            onClick={() => onOpen(f)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 active:bg-gray-50 text-left"
          >
            <div className={`w-11 h-11 rounded-xl ${f.iconBg} flex items-center justify-center text-xl flex-shrink-0`}>
              {f.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{f.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{f.subtitle}</p>
            </div>
            {f.count > 0 && (
              <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
