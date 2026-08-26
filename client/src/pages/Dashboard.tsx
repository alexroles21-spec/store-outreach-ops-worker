import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, CheckCircle2, Clock3, Loader2, Play, Radar, ShieldAlert, Store, Target, TimerReset, TriangleAlert, UsersRound } from "lucide-react";
import { toast } from "sonner";

function formatDate(value?: Date | string | null) {
  if (!value) return "No runs yet";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MetricCard({ label, value, detail, icon: Icon, accent }: { label: string; value: number | string; detail: string; icon: typeof Store; accent: string }) {
  return (
    <Card className="group relative overflow-hidden border-0 bg-white/90 shadow-[0_14px_40px_rgba(35,35,25,0.06)] ring-1 ring-[#e8e4db] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(35,35,25,0.1)]">
      <div className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
      <CardContent className="p-5 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b897f]">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#252821]">{value}</p>
            <p className="mt-2 text-xs text-[#77786e]">{detail}</p>
          </div>
          <div className="rounded-2xl bg-[#f4f1e9] p-3 text-[#6d7562] transition-colors group-hover:bg-[#eaf0e6] group-hover:text-[#2d6a4f]">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const utils = trpc.useUtils();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(undefined, { refetchInterval: 30000 });
  const { data: runs, isLoading: runsLoading } = trpc.dashboard.runs.useQuery(undefined, { refetchInterval: 30000 });
  const { data: settings } = trpc.automation.settings.useQuery(undefined, { refetchInterval: 30000 });
  const runNow = trpc.automation.runNow.useMutation({
    onSuccess: result => {
      toast.success(`Run complete · ${result.qualified} qualified stores`);
      utils.dashboard.stats.invalidate();
      utils.dashboard.runs.invalidate();
      utils.leads.search.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const toggle = trpc.automation.enableHourly.useMutation({
    onSuccess: () => {
      toast.success("Hourly workflow enabled");
      utils.automation.settings.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const disable = trpc.automation.disableHourly.useMutation({
    onSuccess: () => {
      toast.success("Hourly workflow paused");
      utils.automation.settings.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const latest = stats?.latestRun;
  const target = latest?.targetCount ?? settings?.targetPerRun ?? 84;
  const qualified = latest?.qualifiedCount ?? 0;
  const progress = target ? Math.min(100, Math.round((qualified / target) * 100)) : 0;
  const isBusy = runNow.isPending || toggle.isPending || disable.isPending;

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-[#f7f5ef] px-1 pb-8 text-[#252821]">
      <div className="mx-auto max-w-[1440px] space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-[#e4e0d7] pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#738066]"><span className="h-2 w-2 rounded-full bg-[#3f9365] shadow-[0_0_0_4px_rgba(63,147,101,0.12)]" /> Private workspace</div>
            <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[#242820] md:text-5xl">Good morning, operator.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#72736a]">A quiet command center for discovering qualified stores, protecting sender reputation, and keeping every outreach decision traceable.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-9 gap-2 rounded-full border-[#d9e5d8] bg-[#eef7ee] px-3 text-[#33724e]"><span className="h-1.5 w-1.5 rounded-full bg-[#3d9a68]" />{settings?.enabled ? "Hourly workflow live" : "Workflow paused"}</Badge>
            <Button onClick={() => runNow.mutate()} disabled={isBusy} className="h-10 rounded-full bg-[#263e31] px-4 text-white shadow-[0_8px_18px_rgba(38,62,49,0.18)] hover:bg-[#1e3327]">
              {runNow.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />} Run now
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Stores qualified" value={statsLoading ? "—" : stats?.qualifiedLeads ?? 0} detail="Live e-commerce signals" icon={CheckCircle2} accent="bg-[#4f936e]" />
          <MetricCard label="Queued outreach" value={statsLoading ? "—" : stats?.queuedOutreach ?? 0} detail="Ready for configured transport" icon={Target} accent="bg-[#bd8a3e]" />
          <MetricCard label="Protected forms" value={statsLoading ? "—" : stats?.protectedForms ?? 0} detail="Routed to review, never bypassed" icon={ShieldAlert} accent="bg-[#8f7565]" />
          <MetricCard label="Verification failures" value={statsLoading ? "—" : stats?.verificationFailures ?? 0} detail="Inactive or inconclusive stores" icon={TriangleAlert} accent="bg-[#b85c53]" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="border-0 bg-[#263e31] text-white shadow-[0_20px_55px_rgba(38,62,49,0.18)]">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col justify-between gap-8 md:flex-row">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-[#b9d4b4]"><Radar className="h-4 w-4" /> Current operating cycle</div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">{latest?.status === "running" ? "Qualification in progress" : "Ready for the next sweep"}</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#c9d6ca]">The workflow checks public signals, verifies live stores, records contact routes, and moves protected forms into a human review lane.</p>
                </div>
                <div className="flex min-w-[190px] flex-col justify-between rounded-2xl bg-white/10 p-4">
                  <div className="flex items-center justify-between text-xs text-[#c9d6ca]"><span>Latest run</span><Clock3 className="h-4 w-4" /></div>
                  <p className="mt-6 text-lg font-medium">{formatDate(latest?.startedAt)}</p>
                  <p className="mt-1 text-xs text-[#aac4ad]">{latest ? `${latest.discoveredCount} discovered · ${latest.qualifiedCount} qualified` : "Waiting for first run"}</p>
                </div>
              </div>
              <div className="mt-9 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div><div className="mb-2 flex justify-between text-xs text-[#c9d6ca]"><span>Target completion</span><span>{qualified} / {target}</span></div><Progress value={progress} className="h-2 bg-white/15 [&>div]:bg-[#c6e3bc]" /></div>
                <div className="flex items-center gap-2 text-xs text-[#b9d4b4]"><TimerReset className="h-4 w-4" /> Every 60 minutes</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/90 shadow-[0_14px_40px_rgba(35,35,25,0.06)] ring-1 ring-[#e8e4db]">
            <CardHeader className="flex-row items-center justify-between pb-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b897f]">Automation</p><CardTitle className="mt-1 text-xl tracking-[-0.03em]">Hourly engine</CardTitle></div><div className={`rounded-xl p-2.5 ${settings?.enabled ? "bg-[#eaf4e8] text-[#3c825b]" : "bg-[#f5ece9] text-[#a35c50]"}`}><TimerReset className="h-5 w-5" /></div></CardHeader>
            <CardContent>
              <div className="mt-3 flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${settings?.enabled ? "bg-[#4b9c6a]" : "bg-[#b87569]"}`} /><span className="text-sm font-medium text-[#3c4037]">{settings?.enabled ? "Running automatically" : "Paused"}</span></div>
              <p className="mt-3 text-sm leading-6 text-[#77786e]">Up to <strong className="font-semibold text-[#30342b]">{settings?.targetPerRun ?? 84}</strong> candidate stores per cycle from permitted public sources.</p>
              <div className="mt-6 flex gap-2">{settings?.enabled ? <Button variant="outline" onClick={() => disable.mutate()} disabled={isBusy} className="flex-1 rounded-full border-[#dcd8ce] bg-transparent">Pause</Button> : <Button onClick={() => toggle.mutate()} disabled={isBusy} className="flex-1 rounded-full bg-[#263e31] hover:bg-[#1e3327]">Enable hourly</Button>}<Button variant="outline" className="rounded-full border-[#dcd8ce] bg-transparent px-3" onClick={() => toast.info("Hourly schedule is managed in the private workspace settings.")} aria-label="View schedule"><ArrowUpRight className="h-4 w-4" /></Button></div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-0 bg-white/90 shadow-[0_14px_40px_rgba(35,35,25,0.06)] ring-1 ring-[#e8e4db]"><CardHeader className="flex-row items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b897f]">Run history</p><CardTitle className="mt-1 text-xl tracking-[-0.03em]">Recent cycles</CardTitle></div><span className="text-xs text-[#96968c]">UTC display adapts to your locale</span></CardHeader><CardContent className="pt-0"><div className="space-y-1">{runsLoading ? <div className="flex h-28 items-center justify-center text-[#8b897f]"><Loader2 className="h-5 w-5 animate-spin" /></div> : runs?.length ? runs.slice(0, 6).map(run => <div key={run.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-[#eeebe4] py-3.5 md:grid-cols-[1.2fr_0.75fr_0.75fr_0.65fr_auto]"><div><p className="text-sm font-medium text-[#35382f]">Cycle #{String(run.id).padStart(4, "0")}</p><p className="mt-1 text-xs text-[#94948a]">{formatDate(run.startedAt)}</p></div><div className="hidden text-sm text-[#63655d] md:block">{run.discoveredCount} discovered</div><div className="hidden text-sm text-[#3f7f58] md:block">{run.qualifiedCount} qualified</div><div className="hidden md:block"><Badge variant="outline" className={run.status === "completed" ? "border-[#d8ead9] bg-[#eff8ef] text-[#3d8057]" : "border-[#efddd7] bg-[#fff5f1] text-[#a36458]"}>{run.status}</Badge></div><div className="text-right text-xs text-[#888a80]">{run.protectedForms} protected</div></div>) : <div className="py-10 text-center text-sm text-[#85867c]">No cycle has been recorded yet. Start your first sweep above.</div>}</div></CardContent></Card>
          <Card className="border-0 bg-[#f0eee7] shadow-none"><CardContent className="p-6 md:p-7"><div className="flex items-center gap-2 text-[#77806e]"><UsersRound className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Operating guardrails</span></div><h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[#30362d]">Evidence before action.</h3><p className="mt-3 text-sm leading-6 text-[#74776e]">Every lead carries its verification evidence and contact route. CAPTCHA-protected forms are recorded as review-only, so the workflow never attempts to defeat an anti-bot control.</p><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/70 p-4"><Store className="h-4 w-4 text-[#5e8e68]" /><p className="mt-3 text-xs text-[#85877d]">Total leads</p><p className="mt-1 text-2xl font-semibold text-[#30362d]">{stats?.totalLeads ?? 0}</p></div><div className="rounded-2xl bg-white/70 p-4"><ShieldAlert className="h-4 w-4 text-[#9a755f]" /><p className="mt-3 text-xs text-[#85877d]">Review lane</p><p className="mt-1 text-2xl font-semibold text-[#30362d]">{stats?.protectedForms ?? 0}</p></div></div></CardContent></Card>
        </section>
      </div>
    </div>
  );
}
