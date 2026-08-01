import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Users, UserRound, Camera, RotateCcw, Loader2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { apiFetch, apiMutate } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { fmtMoney, curSymbol } from "@/lib/currency";

interface BinGroup {
  id: number;
  name: string;
  category: string | null;
  deletedAt: string | null;
}

interface BinWorker {
  id: number;
  name: string;
  wageRate: string | null;
  wageUnit: string | null;
}

interface BinUpdate {
  id: number;
  date: string;
  description: string;
  photoUrl: string | null;
  deletedAt: string | null;
}

interface BinData {
  groups: BinGroup[];
  workers: BinWorker[];
  updates: BinUpdate[];
  retentionDays: number;
}

type BinItemType = "group" | "worker" | "update";

interface ConfirmForever {
  type: BinItemType;
  id: number;
  label: string;
}

function daysLeft(deletedAt: string | null, retentionDays: number): number {
  if (!deletedAt) return retentionDays;
  const gone = new Date(deletedAt).getTime() + retentionDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((gone - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function BinPage() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [confirmForever, setConfirmForever] = useState<ConfirmForever | null>(null);

  const { data, isLoading } = useQuery<BinData>({
    queryKey: ["bin"],
    queryFn: () => apiFetch("/bin"),
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ["bin"] });
    void queryClient.invalidateQueries({ queryKey: ["work-groups"] });
    void queryClient.invalidateQueries({ queryKey: ["workers"] });
    void queryClient.invalidateQueries({ queryKey: ["estate-updates"] });
  }

  const restore = useMutation({
    mutationFn: ({ type, id }: { type: BinItemType; id: number }) =>
      apiMutate("POST", "/bin/restore", { type, id }),
    onSuccess: invalidateAll,
  });

  const deleteForever = useMutation({
    mutationFn: ({ type, id }: { type: BinItemType; id: number }) =>
      apiMutate("DELETE", `/bin/${type}/${id}`),
    onSuccess: () => {
      setConfirmForever(null);
      invalidateAll();
    },
  });

  const retention = data?.retentionDays ?? 30;
  const isEmpty =
    !isLoading &&
    data &&
    data.groups.length === 0 &&
    data.workers.length === 0 &&
    data.updates.length === 0;

  function itemActions(type: BinItemType, id: number, label: string) {
    const isRestoring =
      restore.isPending && restore.variables?.type === type && restore.variables?.id === id;
    return (
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => restore.mutate({ type, id })}
          disabled={restore.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 px-3 py-2 text-sm font-semibold active:bg-primary/20"
        >
          {isRestoring ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {t("bin.restore")}
        </button>
        <button
          aria-label={`${t("bin.deleteForever")}: ${label}`}
          onClick={() => setConfirmForever({ type, id, label })}
          className="rounded-lg border border-red-200 text-red-600 px-2.5 py-2 active:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <PageShell title={t("bin.title")} back="/">
      <div className="p-4 space-y-5 pb-10">
        <p className="text-sm text-gray-500">{t("bin.sub")}</p>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {isEmpty && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <Trash2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t("bin.empty")}</p>
          </div>
        )}

        {/* Work groups */}
        {data && data.groups.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-gray-800">{t("bin.groups")}</h2>
            </div>
            <div className="space-y-2">
              {data.groups.map((g) => (
                <div
                  key={g.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">{g.name}</p>
                    <p className="text-xs text-gray-400">
                      {daysLeft(g.deletedAt, retention)}d
                    </p>
                  </div>
                  {itemActions("group", g.id, g.name)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Workers */}
        {data && data.workers.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <UserRound className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-gray-800">{t("bin.workers")}</h2>
            </div>
            <div className="space-y-2">
              {data.workers.map((w) => (
                <div
                  key={w.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">{w.name}</p>
                    {w.wageRate && (
                      <p className="text-xs text-gray-400">
                        {fmtMoney(Number(w.wageRate))}
                        {w.wageUnit ? ` / ${w.wageUnit}` : ""}
                      </p>
                    )}
                  </div>
                  {itemActions("worker", w.id, w.name)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Work photos / updates */}
        {data && data.updates.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Camera className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-gray-800">{t("bin.photos")}</h2>
            </div>
            <div className="space-y-2">
              {data.updates.map((u) => (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3"
                >
                  {u.photoUrl ? (
                    <img
                      src={u.photoUrl}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover shrink-0 bg-gray-100"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Camera className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">{u.description}</p>
                    <p className="text-xs text-gray-400">
                      {u.date} · {daysLeft(u.deletedAt, retention)}d
                    </p>
                  </div>
                  {itemActions("update", u.id, u.description)}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Confirm delete forever ── */}
      {confirmForever && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40">
          <div className="bg-white rounded-t-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl p-2.5 bg-red-100 text-red-600 flex-shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-800">{t("bin.deleteForever")}?</h2>
                <p className="text-sm text-gray-500 truncate">{confirmForever.label}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {confirmForever.type === "group" &&
                "All attendance days, advance payments and work photos of this group will be deleted forever. Workers, their loans and your farm account entries are kept."}
              {confirmForever.type === "worker" &&
                "This worker's attendance, loans and loan payments will be deleted forever. This cannot be undone."}
              {confirmForever.type === "update" &&
                "This work photo/update will be deleted forever. This cannot be undone."}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setConfirmForever(null)}
                className="flex-1 rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  deleteForever.mutate({ type: confirmForever.type, id: confirmForever.id })
                }
                disabled={deleteForever.isPending}
                className="flex-1 rounded-xl h-12 bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteForever.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("bin.deleteForever")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
