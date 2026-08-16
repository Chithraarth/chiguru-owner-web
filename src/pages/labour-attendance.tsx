import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, ClipboardList } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GroupFolderList, buildGroupIds } from "@/components/group-folders";
import { apiFetch } from "@/lib/api";
import { useSubScreenHistory } from "@/hooks/use-sub-screen-history";
import { useT } from "@/lib/i18n";

interface AttendanceRecord {
  id: number;
  workerName: string;
  workGroupId: number | null;
  workGroupName: string | null;
  date: string;
  hoursWorked: number | null;
  overtimeHours?: number | null;
  wageAmount: string | null;
  notes: string | null;
  createdAt?: string | null;
}

interface WorkGroup {
  id: number;
  name: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" });
}

// Server-recorded time (DB sets createdAt) — a device with a wrong clock
// can't fake when the attendance was actually marked.
function fmtRecordedAt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** Attendance-only view: who worked, how many days/works till date. No money. */
export default function LabourAttendance() {
  const { t } = useT();
  const [openFolder, setOpenFolder] = useState<{ id: number | null; name: string } | null>(null);
  useSubScreenHistory(openFolder ? 1 : 0, () => setOpenFolder(null));

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance-all"],
    queryFn: () => apiFetch("/attendance"),
  });

  const { data: workGroups = [] } = useQuery<WorkGroup[]>({
    queryKey: ["work-groups"],
    queryFn: async () => (await apiFetch("/work-groups")) as WorkGroup[],
  });

  const groupList = buildGroupIds(workGroups, records);
  const generalRecords = records.filter((r) => r.workGroupId == null);
  const folders = [
    ...groupList.map((g) => {
      const recs = records.filter((r) => r.workGroupId === g.id);
      const days = new Set(recs.map((r) => r.date)).size;
      return {
        id: g.id as number | null,
        name: g.name,
        subtitle: recs.length === 0 ? "No attendance yet" : `${recs.length} works · ${days} days`,
        count: recs.length,
        emoji: "🗓️",
        iconBg: "bg-emerald-50",
      };
    }),
    {
      id: null,
      name: "General Records",
      subtitle: generalRecords.length === 0 ? "Records without a group" : `${generalRecords.length} works`,
      count: generalRecords.length,
      emoji: "📋",
      iconBg: "bg-gray-100",
    },
  ];

  const folderRecords = openFolder
    ? records.filter((r) => (r.workGroupId ?? null) === openFolder.id)
    : [];

  // ── Till-date summary per worker ──
  interface WorkerTotals { works: number; hours: number; overtime: number; lastDate: string }
  const perWorker = new Map<string, WorkerTotals>();
  for (const r of folderRecords) {
    const wt = perWorker.get(r.workerName) ?? { works: 0, hours: 0, overtime: 0, lastDate: "" };
    wt.works += 1;
    wt.hours += Number(r.hoursWorked ?? 0);
    wt.overtime += Number(r.overtimeHours ?? 0);
    if (r.date > wt.lastDate) wt.lastDate = r.date;
    perWorker.set(r.workerName, wt);
  }
  const workerRows = [...perWorker.entries()].sort((a, b) => b[1].works - a[1].works);
  const totalWorks = folderRecords.length;
  const totalDays = new Set(folderRecords.map((r) => r.date)).size;

  const byDate = folderRecords.reduce<Record<string, AttendanceRecord[]>>((acc, r) => {
    (acc[r.date] = acc[r.date] || []).push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <PageShell
      title={openFolder ? openFolder.name : t("farmAcct.labourAttendance")}
      back={openFolder ? undefined : "/farm-accounts"}
      onBack={openFolder ? () => setOpenFolder(null) : undefined}
    >
      <div className="p-4 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && openFolder === null && (
          <GroupFolderList folders={folders} onOpen={(f) => setOpenFolder({ id: f.id, name: f.name })} />
        )}

        {/* ── Till-date totals ── */}
        {!isLoading && openFolder !== null && folderRecords.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 opacity-80" />
              <span className="font-semibold text-sm">Attendance till date</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-50 text-center">
              <div className="py-3">
                <p className="text-lg font-bold text-gray-800">{totalWorks}</p>
                <p className="text-[11px] text-gray-400">Works done</p>
              </div>
              <div className="py-3">
                <p className="text-lg font-bold text-gray-800">{totalDays}</p>
                <p className="text-[11px] text-gray-400">Work days</p>
              </div>
              <div className="py-3">
                <p className="text-lg font-bold text-gray-800">{workerRows.length}</p>
                <p className="text-[11px] text-gray-400">Employees</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Per-worker summary ── */}
        {!isLoading && openFolder !== null && workerRows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase">Each employee till date</p>
            </div>
            <div className="divide-y divide-gray-50">
              {workerRows.map(([name, wt]) => (
                <div key={name} className="px-4 py-3 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{name}</p>
                    <p className="text-xs text-gray-400">Last work {formatDate(wt.lastDate)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary">{wt.works} work{wt.works !== 1 ? "s" : ""}</p>
                    <p className="text-[11px] text-gray-400">
                      {wt.hours > 0 && `${wt.hours} hrs`}
                      {wt.overtime > 0 && ` · +${wt.overtime} hrs OT`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && openFolder !== null && folderRecords.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-14 w-14 text-gray-200 mb-4" />
            <p className="text-gray-500 text-base font-medium">No attendance for {openFolder.name} yet</p>
            <p className="text-gray-400 text-sm mt-1">Records will appear here after attendance is marked</p>
          </div>
        )}

        {/* ── Day-by-day records ── */}
        {openFolder !== null && sortedDates.length > 0 && (
          <p className="text-xs font-semibold text-gray-500 uppercase px-1 pt-1">Daily records</p>
        )}
        {openFolder !== null && sortedDates.map((date) => {
          const entries = byDate[date];
          return (
            <div key={date} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 opacity-80" />
                  <span className="font-semibold text-sm">{formatDate(date)}</span>
                </div>
                <span className="text-primary-foreground/80 text-xs">
                  {entries.length} worker{entries.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {entries.map((entry) => (
                  <div key={entry.id} className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{entry.workerName}</p>
                      {entry.notes && (
                        <p className="text-xs text-gray-500 mt-1 leading-snug">{entry.notes}</p>
                      )}
                      {entry.createdAt && (
                        <p className="text-[11px] text-gray-400 mt-0.5">Recorded {fmtRecordedAt(entry.createdAt)}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 text-xs text-gray-400">
                      {entry.hoursWorked != null && <p>{entry.hoursWorked}h</p>}
                      {Number(entry.overtimeHours ?? 0) > 0 && (
                        <p className="text-amber-600">+{entry.overtimeHours} hrs OT</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
