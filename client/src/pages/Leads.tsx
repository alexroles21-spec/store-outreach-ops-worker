import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Eye, ExternalLink, FileText, Loader2, Mail, Search, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Status = "all" | "not_contacted" | "queued" | "review" | "sent" | "failed" | "do_not_contact";

const statusLabel: Record<Status, string> = {
  all: "All statuses",
  not_contacted: "Not contacted",
  queued: "Queued",
  review: "Review required",
  sent: "Sent",
  failed: "Failed",
  do_not_contact: "Do not contact",
};

function StatusBadge({ status, protectedForm }: { status: string; protectedForm: boolean }) {
  const tone = protectedForm || status === "review" ? "border-[#ead9c8] bg-[#fff7ed] text-[#9a6e48]" : status === "queued" ? "border-[#d5e8d7] bg-[#f0f8f0] text-[#3e8057]" : status === "sent" ? "border-[#d6e3ee] bg-[#f1f7fb] text-[#4d7596]" : status === "do_not_contact" ? "border-[#edd9d6] bg-[#fff4f2] text-[#a76057]" : "border-[#e2dfd7] bg-[#f8f7f2] text-[#77786e]";
  return <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone}`}>{protectedForm ? "Protected form" : statusLabel[status as Status] ?? status}</Badge>;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Leads() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const { data: leads, isLoading, isFetching } = trpc.leads.search.useQuery({ query, status }, { refetchInterval: 30000 });
  const utils = trpc.useUtils();
  const setLeadStatus = trpc.leads.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Lead status updated");
      utils.leads.search.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const selected = useMemo(() => leads?.find(lead => lead.id === selectedId), [leads, selectedId]);
  const previewLead = useMemo(() => leads?.find(lead => lead.id === previewId), [leads, previewId]);
  const messagePreview = trpc.message.preview.useQuery(previewLead ? { storeName: previewLead.storeName, niche: previewLead.niche, storeUrl: previewLead.storeUrl } : { storeName: "Preview", niche: "e-commerce", storeUrl: "https://example.com" }, { enabled: Boolean(previewLead) });
  const { data: events } = trpc.leads.events.useQuery({ leadId: selectedId ?? 0 }, { enabled: Boolean(selectedId) });
  const review = trpc.leads.review.useMutation({
    onSuccess: () => { toast.success("Review decision saved"); utils.leads.search.invalidate(); utils.leads.events.invalidate(); utils.dashboard.stats.invalidate(); },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selected, selectedId]);

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-[#f7f5ef] px-1 pb-8 text-[#252821]">
      <div className="mx-auto max-w-[1440px] space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-[#e4e0d7] pb-6 md:flex-row md:items-end"><div><div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#738066]"><span className="h-2 w-2 rounded-full bg-[#b88945]" /> Lead intelligence</div><h1 className="text-4xl font-semibold tracking-[-0.055em] text-[#242820] md:text-5xl">Lead directory.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#72736a]">Search every verified store, understand the contact route, and keep protected forms in a separate review lane.</p></div><div className="flex items-center gap-2 text-xs text-[#8b897f]"><FileText className="h-4 w-4" /> {leads?.length ?? 0} records in view</div></header>

        <Card className="border-0 bg-white/90 shadow-[0_14px_40px_rgba(35,35,25,0.06)] ring-1 ring-[#e8e4db]"><CardContent className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98988e]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search stores, niches, URLs, or contact routes" className="h-11 border-[#e0ddd3] bg-[#faf9f5] pl-10 text-sm placeholder:text-[#aaa99f] focus-visible:ring-[#9eb89a]" /></div><Select value={status} onValueChange={value => setStatus(value as Status)}><SelectTrigger className="h-11 w-full border-[#e0ddd3] bg-[#faf9f5] text-sm lg:w-[190px]"><SlidersHorizontal className="mr-2 h-4 w-4 text-[#85877d]" /><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabel).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>{isFetching && <Loader2 className="hidden h-4 w-4 animate-spin text-[#8b897f] sm:block" />}</div></CardContent></Card>

        <div className="grid gap-5 xl:grid-cols-[1fr_350px]">
          <Card className="overflow-hidden border-0 bg-white/90 shadow-[0_14px_40px_rgba(35,35,25,0.06)] ring-1 ring-[#e8e4db]"><CardHeader className="flex-row items-center justify-between border-b border-[#eeebe4] pb-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b897f]">Verified records</p><CardTitle className="mt-1 text-xl tracking-[-0.03em]">Stores and contact routes</CardTitle></div><Badge variant="outline" className="rounded-full border-[#e4e0d7] bg-[#faf9f5] text-[#77786e]">Live index</Badge></CardHeader><CardContent className="p-0"><div className="hidden grid-cols-[1.3fr_0.85fr_1fr_0.8fr_0.8fr] gap-4 border-b border-[#eeebe4] bg-[#faf9f5] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94948a] md:grid"><span>Store</span><span>Region / niche</span><span>Contact route</span><span>Status</span><span>Verified</span></div>{isLoading ? <div className="flex h-56 items-center justify-center text-[#88897f]"><Loader2 className="h-5 w-5 animate-spin" /></div> : leads?.length ? <div>{leads.map(lead => <button key={lead.id} onClick={() => setSelectedId(lead.id)} className={`grid w-full grid-cols-1 gap-3 border-b border-[#eeebe4] px-5 py-4 text-left transition-colors hover:bg-[#fbfaf6] md:grid-cols-[1.3fr_0.85fr_1fr_0.8fr_0.8fr] md:items-center md:gap-4 ${selectedId === lead.id ? "bg-[#f4f7f1]" : ""}`}><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-[#363a31]">{lead.storeName}</span>{lead.contactFormProtected && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#a87955]" />}</div><p className="mt-1 truncate text-xs text-[#999990]">{lead.storeUrl}</p></div><div className="flex items-center gap-2 text-xs text-[#6f7168]"><span className="rounded-full bg-[#f0eee7] px-2 py-1">{lead.region}</span><span className="truncate">{lead.niche}</span></div><div className="flex min-w-0 items-center gap-2 text-xs text-[#77786e]"><Mail className="h-3.5 w-3.5 shrink-0 text-[#9a9b91]" /><span className="truncate">{lead.publicContactRoute ?? "No public route found"}</span></div><div><StatusBadge status={lead.contactStatus} protectedForm={lead.contactFormProtected} /></div><div className="text-xs text-[#999990]">{formatDate(lead.lastVerifiedAt)}</div></button>)}</div> : <div className="px-5 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0eee7] text-[#8a8b80]"><Search className="h-5 w-5" /></div><p className="mt-4 text-sm font-medium text-[#55584f]">No leads match this view</p><p className="mt-1 text-xs text-[#96968d]">Start a run or adjust your search terms.</p></div>}</CardContent></Card>

          <Card className="border-0 bg-[#263e31] text-white shadow-[0_20px_55px_rgba(38,62,49,0.15)]"><CardContent className="p-6">{selected ? <div className="space-y-6"><div><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b9d4b4]">Lead detail</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{selected.storeName}</h2></div><button onClick={() => setSelectedId(null)} className="text-xs text-[#b9d4b4] hover:text-white">Clear</button></div><a href={selected.storeUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-xs text-[#c9d6ca] hover:text-white">{selected.storeUrl}<ExternalLink className="h-3 w-3" /></a></div><div className="grid grid-cols-2 gap-3">{[["Niche", selected.niche], ["Region", selected.region], ["Route", selected.contactRouteType], ["Verified", formatDate(selected.lastVerifiedAt)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-white/10 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-[#a9c2ad]">{label}</p><p className="mt-2 truncate text-sm font-medium text-white">{value}</p></div>)}</div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-[#d7e6d5]"><ShieldAlert className="h-4 w-4" /> Verification evidence</div><p className="mt-3 text-xs leading-5 text-[#bfd0c0]">{selected.verificationEvidence}</p></div>{selected.contactFormProtected && <div className="rounded-2xl border border-[#d6af86]/30 bg-[#b98552]/15 p-4"><p className="text-xs font-semibold text-[#f1d5af]">Review required</p><p className="mt-2 text-xs leading-5 text-[#dcc4a5]">{selected.protectionReason ?? "This form exposes an anti-bot protection signal."} No bypass is attempted.</p></div>}<div className="rounded-2xl bg-white/5 p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#d7e6d5]">Review history</p><span className="text-[10px] uppercase tracking-[0.12em] text-[#a9c2ad]">{selected.reviewStatus}</span></div><div className="mt-3 space-y-2">{events?.slice(0, 3).map(event => <div key={event.id} className="flex items-center justify-between gap-3 text-[11px] text-[#bfd0c0]"><span>{event.eventType} · {event.outcome}</span><span className="shrink-0 text-[#8fa994]">{formatDate(event.createdAt)}</span></div>)}</div></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setPreviewId(selected.id)} className="rounded-full bg-[#d7e6c9] text-[#263e31] hover:bg-white"><Eye className="mr-1.5 h-3.5 w-3.5" /> Preview message</Button>{selected.contactFormProtected && <><Button size="sm" variant="outline" onClick={() => review.mutate({ id: selected.id, status: "reviewed", note: "Reviewed in private dashboard" })} disabled={review.isPending} className="rounded-full border-white/20 bg-transparent text-[#d7e6d5] hover:bg-white/10 hover:text-white">Mark reviewed</Button><Button size="sm" variant="outline" onClick={() => review.mutate({ id: selected.id, status: "approved_manual", note: "Approved for manual handling" })} disabled={review.isPending} className="rounded-full border-white/20 bg-transparent text-[#d7e6d5] hover:bg-white/10 hover:text-white">Manual lane</Button><Button size="sm" variant="outline" onClick={() => review.mutate({ id: selected.id, status: "dismissed", note: "Dismissed from review" })} disabled={review.isPending} className="rounded-full border-[#d6af86]/30 bg-transparent text-[#f1d5af] hover:bg-[#b98552]/20 hover:text-white">Dismiss</Button></>}{selected.contactStatus !== "do_not_contact" && <Button size="sm" variant="outline" onClick={() => setLeadStatus.mutate({ id: selected.id, status: "do_not_contact", reason: "Marked from private dashboard" })} disabled={setLeadStatus.isPending} className="rounded-full border-white/20 bg-transparent text-[#d7e6d5] hover:bg-white/10 hover:text-white">Suppress</Button>}</div></div> : <div className="flex min-h-[420px] flex-col justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b9d4b4]">Inspection pane</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Select a store.</h2><p className="mt-3 text-sm leading-6 text-[#c9d6ca]">Open any record to see the public route, verification evidence, and whether it needs a safe review step.</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-medium text-[#d7e6d5]">Protected forms stay visible</p><p className="mt-2 text-xs leading-5 text-[#b9d0bc]">CAPTCHA and similar protections are classified, recorded, and left for review. Nothing is bypassed.</p></div></div>}</CardContent></Card>
        </div>

        {previewLead && <Card className="border-0 bg-white/90 shadow-[0_14px_40px_rgba(35,35,25,0.06)] ring-1 ring-[#e8e4db]"><CardHeader className="flex-row items-center justify-between border-b border-[#eeebe4] pb-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b897f]">Personalization engine</p><CardTitle className="mt-1 text-xl tracking-[-0.03em]">Message preview for {previewLead.storeName}</CardTitle></div><Button variant="ghost" onClick={() => setPreviewId(null)} className="text-[#77786e]">Close</Button></CardHeader><CardContent className="grid gap-4 p-5 md:grid-cols-[0.4fr_1fr]"><div className="rounded-2xl bg-[#f0eee7] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b897f]">Subject</p><p className="mt-3 text-sm font-semibold text-[#34382f]">{messagePreview.data?.subject ?? "Loading…"}</p><p className="mt-6 text-xs leading-5 text-[#77786e]">Only the store name, niche, and URL variables are personalized. The supplied structure remains intact.</p></div><Textarea readOnly value={messagePreview.data?.body ?? "Loading message…"} className="min-h-[260px] resize-none border-[#e0ddd3] bg-[#faf9f5] text-sm leading-6 text-[#45483f]" /></CardContent></Card>}
      </div>
    </div>
  );
}
