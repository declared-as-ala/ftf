'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, Download, Goal, History, MapPin, Pencil, Plus, RectangleVertical, RefreshCw, Save, ShieldAlert, Trash2, UserRound, Users, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { AuditTimeline } from '@/components/ui/AuditTimeline';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

const tabs = [
  ['overview', 'Vue d’ensemble'], ['result', 'Résultat'], ['goals', 'Buts'], ['cards', 'Cartons'],
  ['discipline', 'Discipline'], ['officials', 'Arbitres'], ['history', 'Historique'],
] as const;
const goalTypes = ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'];
const cardTypes = ['YELLOW', 'SECOND_YELLOW_RED', 'DIRECT_RED'];
const eventLabels: Record<string, string> = { GOAL: 'But', OWN_GOAL: 'But contre son camp', PENALTY_GOAL: 'Penalty', YELLOW: 'Carton jaune', SECOND_YELLOW_RED: 'Deuxième avertissement — exclusion', DIRECT_RED: 'Carton rouge direct' };
const statusLabels: Record<string, string> = { 'Brouillon': 'Brouillon', 'Programmé': 'Programmé', 'ProgrammÃ©': 'Programmé', 'En Cours': 'En cours', 'À Valider': 'En attente de validation', 'Ã€ Valider': 'En attente de validation', 'Terminé': 'Officiel', 'TerminÃ©': 'Officiel', 'Reporté': 'Reporté', 'ReportÃ©': 'Reporté', 'Annulé': 'Annulé', 'AnnulÃ©': 'Annulé', 'Abandonné': 'Arrêté', 'Forfait': 'Forfait', 'Replay Ordonné': 'À rejouer' };

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Une erreur est survenue');
  return body;
}

export default function MatchWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const activeTab = tabs.some(([key]) => key === search.get('tab')) ? search.get('tab')! : 'overview';
  const [workspace, setWorkspace] = useState<any>(null);
  const [impact, setImpact] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<'finalize' | 'reopen' | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventForm, setEventForm] = useState<any>({ type: 'GOAL', clubId: '', playerId: '', minute: 0, stoppageMinute: '', assistPlayerId: '', cardReason: '', reportReference: '', notes: '' });
  const [resultForm, setResultForm] = useState<any>({});

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const data = await jsonFetch(`/api/admin/matches/${id}`);
      setWorkspace(data);
      const m = data.match;
      setResultForm({ scoreHome: m.scoreHome, scoreAway: m.scoreAway, statut: m.statut, date: new Date(m.date).toISOString().slice(0, 16), stade: m.stade || '', venueCity: m.venueCity || '', spectateurs: m.spectateurs ?? '', notes: m.notes || '', expectedProcessingVersion: m.processingVersion, overrideReasonCode: m.scoreOverride?.reasonCode || '', overrideExplanation: m.scoreOverride?.explanation || '' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (activeTab === 'discipline') jsonFetch(`/api/admin/matches/${id}/discipline-impact`).then(setImpact).catch((e) => setError(e.message));
    if (activeTab === 'history') jsonFetch(`/api/admin/matches/${id}/audit`).then((d) => setLogs(d.logs)).catch((e) => setError(e.message));
  }, [activeTab, id]);
  useEffect(() => {
    if (!eventForm.clubId) { setPlayers([]); return; }
    jsonFetch(`/api/admin/joueurs?clubId=${eventForm.clubId}&limit=300`).then((data) => setPlayers(Array.isArray(data) ? data : data.joueurs || [])).catch(() => setPlayers([]));
  }, [eventForm.clubId]);

  const match = workspace?.match;
  const events = workspace?.events || [];
  const filteredEvents = useMemo(() => activeTab === 'goals' ? events.filter((e:any) => goalTypes.includes(e.type)) : activeTab === 'cards' ? events.filter((e:any) => cardTypes.includes(e.type)) : events, [events, activeTab]);

  function selectTab(tab: string) { router.replace(`/admin/matches/${id}?tab=${tab}`, { scroll: false }); }
  function onTabKey(event: React.KeyboardEvent, index: number) { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; selectTab(tabs[next][0]); requestAnimationFrame(() => document.getElementById(`tab-${tabs[next][0]}`)?.focus()); }
  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 4500); }

  async function saveResult() {
    try { setBusy(true); setError(''); const payload:any = { scoreHome: Number(resultForm.scoreHome), scoreAway: Number(resultForm.scoreAway), statut: resultForm.statut, date: resultForm.date, stade: resultForm.stade, venueCity: resultForm.venueCity, spectateurs: resultForm.spectateurs === '' ? undefined : Number(resultForm.spectateurs), notes: resultForm.notes, expectedProcessingVersion: resultForm.expectedProcessingVersion };
      if (resultForm.overrideReasonCode && resultForm.overrideExplanation) payload.scoreOverride = { reasonCode: resultForm.overrideReasonCode, explanation: resultForm.overrideExplanation };
      const data = await jsonFetch(`/api/admin/matches/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setWorkspace(data); flash('Brouillon enregistré avec succès.'); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  function beginEvent(type: string) { const firstClub = match?.homeClubId?._id || ''; setEditingEvent(null); setEventForm({ type, clubId: firstClub, playerId: '', minute: 0, stoppageMinute: '', assistPlayerId: '', cardReason: '', reportReference: '', notes: '' }); selectTab(goalTypes.includes(type) ? 'goals' : 'cards'); }
  function editEvent(event:any) { setEditingEvent(event); setEventForm({ type: event.type, clubId: event.clubId?._id, playerId: event.playerId?._id, minute: event.minute, stoppageMinute: event.stoppageMinute ?? '', assistPlayerId: event.assistPlayerId?._id || '', cardReason: event.cardReason || '', reportReference: event.reportReference || '', notes: event.notes || '' }); }
  async function saveEvent(confirmSuspendedPlayer = false, anomalyNote?: string) {
    try { setBusy(true); setError(''); const payload = { ...eventForm, minute: Number(eventForm.minute), stoppageMinute: eventForm.stoppageMinute === '' ? undefined : Number(eventForm.stoppageMinute), assistPlayerId: eventForm.assistPlayerId || null, clientMutationId: crypto.randomUUID(), confirmSuspendedPlayer, anomalyNote };
      const url = editingEvent ? `/api/admin/matches/${id}/events/${editingEvent._id}` : `/api/admin/matches/${id}/events`; const method = editingEvent ? 'PUT' : 'POST'; await jsonFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); setEditingEvent(null); flash(editingEvent ? 'Événement modifié.' : 'Événement ajouté au brouillon.'); await load();
    } catch (e) { const message=(e as Error).message; if (message.includes('suspendu')) { const note=window.prompt('Ce joueur est suspendu. Saisissez la note administrative obligatoire :'); if (note?.trim().length && !confirmSuspendedPlayer) return saveEvent(true,note); } setError(message); } finally { setBusy(false); }
  }
  async function cancelEvent(event:any) { const reason=window.prompt('Motif obligatoire de l’annulation :'); if (!reason || reason.trim().length < 5) return; try { setBusy(true); await jsonFetch(`/api/admin/matches/${id}/events/${event._id}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reason}) }); flash('Événement annulé et conservé dans l’historique.'); await load(); } catch(e){setError((e as Error).message);} finally{setBusy(false);} }
  async function finalize() { try { setBusy(true); await jsonFetch(`/api/admin/matches/${id}/finalize`, {method:'POST'}); flash('Match finalisé. Les effets disciplinaires ont été appliqués.'); await load(); } catch(e){setError((e as Error).message);} finally{setBusy(false);setConfirm(null);} }
  async function reopen() { if(reopenReason.trim().length<5){setError('La raison de réouverture doit comporter au moins 5 caractères.');return;} try{setBusy(true);await jsonFetch(`/api/admin/matches/${id}/reopen`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:reopenReason})});flash('Match rouvert. Les effets dérivés ont été inversés.');setReopenReason('');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);setConfirm(null);} }

  if (loading) return <div className="space-y-4"><Skeleton className="h-64 rounded-xl"/><Skeleton className="h-14"/><Skeleton className="h-72"/></div>;
  if (error && !workspace) return <ErrorState error={error} onRetry={load}/>;
  if (!match) return <ErrorState description="Match introuvable"/>;
  const editable = !match.homologue;

  return <div className="mx-auto w-full max-w-7xl space-y-5 overflow-x-hidden pb-10">
    <div aria-live="polite" className="sr-only">{notice}</div>
    <Link href="/admin/matchs" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="h-4 w-4"/>Retour aux matchs</Link>
    <section className="relative overflow-hidden rounded-2xl border bg-[radial-gradient(120%_140%_at_50%_0%,#183765_0%,#0b1b35_58%,#071226_100%)] text-white shadow-lg">
      <div className="absolute inset-x-0 top-0 h-1 bg-red-600"/>
      <div className="flex flex-col gap-4 p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.2em] text-white/60">{match.competitionId?.nom} · {match.saisonId?.nom} · Journée {match.journee}</p><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-7"><Team club={match.homeClubId}/><div className="text-center"><div className="font-mono text-4xl font-black tabular-nums sm:text-6xl">{match.scoreHome}<span className="mx-2 text-white/35">–</span>{match.scoreAway}</div><Badge className="mt-3 bg-white/10 text-white">{statusLabels[match.statut] || match.statut}</Badge></div><Team club={match.awayClubId} away/></div></div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-xs lg:justify-end">{editable ? <><Button className="min-h-11" onClick={()=>selectTab('result')}><Pencil/>Modifier</Button><Button variant="secondary" className="min-h-11" onClick={()=>beginEvent('GOAL')}><Goal/>Ajouter un but</Button><Button variant="secondary" className="min-h-11" onClick={()=>beginEvent('YELLOW')}><RectangleVertical/>Ajouter un carton</Button><Button variant="outline" className="min-h-11 border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={()=>setConfirm('finalize')}><CheckCircle2/>Finaliser</Button></> : <><Button className="min-h-11" onClick={()=>window.location.assign(`/api/admin/matches/${id}/report`)}><Download/>Rapport</Button><Button variant="outline" className="min-h-11 border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={()=>selectTab('discipline')}><ShieldAlert/>Impact</Button><Button variant="destructive" className="min-h-11" onClick={()=>setConfirm('reopen')}><RefreshCw/>Rouvrir</Button></>}</div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 px-5 py-3 text-sm text-white/65 sm:px-7"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4"/>{new Date(match.date).toLocaleString('fr-TN',{timeZone:'Africa/Tunis',dateStyle:'long',timeStyle:'short'})}</span><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4"/>{match.stade}{match.venueCity ? `, ${match.venueCity}` : ''}</span><span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4"/>{match.arbitrePrincipalId ? `${match.arbitrePrincipalId.prenom} ${match.arbitrePrincipalId.nom}` : 'Arbitre non désigné'}</span></div>
    </section>
    {notice && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</div>}
    {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error}<button className="ml-auto underline" onClick={()=>setError('')}>Fermer</button></div>}
    <div role="tablist" aria-label="Gestion du match" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-muted/30 p-1">{tabs.map(([key,label],index)=><button key={key} id={`tab-${key}`} role="tab" aria-selected={activeTab===key} aria-controls={`panel-${key}`} tabIndex={activeTab===key?0:-1} onKeyDown={(e)=>onTabKey(e,index)} onClick={()=>selectTab(key)} className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab===key?'bg-background text-foreground shadow-sm':'text-muted-foreground hover:bg-background/60 hover:text-foreground'}`}>{label}</button>)}</div>
    <main id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={0} className="focus:outline-none">
      {activeTab==='overview' && <Overview workspace={workspace}/>} 
      {activeTab==='result' && <ResultPanel form={resultForm} setForm={setResultForm} editable={editable} busy={busy} onSave={saveResult}/>} 
      {(activeTab==='goals'||activeTab==='cards') && <EventsPanel events={filteredEvents} clubs={[match.homeClubId,match.awayClubId]} editable={editable} form={eventForm} setForm={setEventForm} players={players} editing={editingEvent} onEdit={editEvent} onCancel={cancelEvent} onSave={()=>saveEvent()} busy={busy} kind={activeTab}/>} 
      {activeTab==='discipline' && <DisciplinePanel impact={impact}/>} 
      {activeTab==='officials' && <OfficialsPanel match={match} publishedOfficials={workspace.publishedOfficials}/>} 
      {activeTab==='history' && <Card><CardHeader><CardTitle>Historique des modifications</CardTitle></CardHeader><CardContent><AuditTimeline entries={logs}/></CardContent></Card>}
    </main>
    <ConfirmationDialog open={confirm==='finalize'} onClose={()=>setConfirm(null)} onConfirm={finalize} title="Finaliser le match" description="Le résultat, les événements, les cartons, les suspensions, le registre de purge et les notifications seront officialisés dans une transaction unique." confirmText={busy?'Finalisation…':'Finaliser'}/>
    {confirm==='reopen' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="reopen-title" className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl"><h2 id="reopen-title" className="text-lg font-bold">Rouvrir le match officiel</h2><p className="mt-2 text-sm text-muted-foreground">Cette action inverse les effets disciplinaires dérivés, conserve l’historique et avertit les clubs.</p><Label htmlFor="reopen-reason" className="mt-5 block">Raison obligatoire</Label><textarea id="reopen-reason" value={reopenReason} onChange={(e)=>setReopenReason(e.target.value)} className="mt-2 min-h-28 w-full rounded-md border bg-background p-3 text-base"/><div className="mt-5 flex justify-end gap-2"><Button variant="outline" className="min-h-11" onClick={()=>setConfirm(null)}>Annuler</Button><Button variant="destructive" className="min-h-11" disabled={busy||reopenReason.trim().length<5} onClick={reopen}>{busy?'Réouverture…':'Confirmer la réouverture'}</Button></div></div></div>}
  </div>;
}

function Team({club,away=false}:{club:any;away?:boolean}) { return <div className={`flex min-w-0 items-center gap-2 ${away?'flex-row-reverse text-right':''}`}><div className="relative h-12 w-12 shrink-0 sm:h-16 sm:w-16">{club?.logo?<Image src={club.logo} alt="" fill className="object-contain"/>:<div className="flex h-full items-center justify-center rounded-full bg-white/10 font-bold">{club?.code||club?.nom?.[0]}</div>}</div><p className="line-clamp-2 text-sm font-bold sm:text-xl">{club?.nom}</p></div> }
function Overview({workspace}:{workspace:any}) { const m=workspace.match; return <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>Vue d’ensemble</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Fact icon={CalendarDays} label="Date et heure" value={new Date(m.date).toLocaleString('fr-TN',{timeZone:'Africa/Tunis'})}/><Fact icon={MapPin} label="Stade" value={`${m.stade}${m.venueCity?`, ${m.venueCity}`:''}`}/><Fact icon={Users} label="Spectateurs" value={m.spectateurs?.toLocaleString('fr-TN')||'Non renseigné'}/><Fact icon={UserRound} label="Arbitre principal" value={m.arbitrePrincipalId?`${m.arbitrePrincipalId.prenom} ${m.arbitrePrincipalId.nom}`:'Non désigné'}/></CardContent></Card><Card><CardHeader><CardTitle>État de validation</CardTitle></CardHeader><CardContent className="space-y-3"><Row label="Officialité" value={m.homologue?'Officiel':'Brouillon'}/><Row label="Buts" value={String(workspace.counts.goals)}/><Row label="Cartons" value={String(workspace.counts.cards)}/><Row label="Score issu des buts" value={`${workspace.scoreFromEvents.home} – ${workspace.scoreFromEvents.away}`}/>{m.scoreOverride&&<p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Dérogation : {m.scoreOverride.reasonCode}</p>}</CardContent></Card>{m.notes&&<Card className="lg:col-span-3"><CardHeader><CardTitle>Notes administratives</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{m.notes}</p></CardContent></Card>}</div> }
function Fact({icon:Icon,label,value}:{icon:any;label:string;value:string}) { return <div className="flex gap-3 rounded-lg border p-4"><Icon className="mt-0.5 h-5 w-5 text-muted-foreground"/><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div></div> }
function Row({label,value}:{label:string;value:string}) { return <div className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div> }
function ResultPanel({form,setForm,editable,busy,onSave}:{form:any;setForm:any;editable:boolean;busy:boolean;onSave:()=>void}) { const set=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v})); return <Card><CardHeader><CardTitle>Résultat du match</CardTitle></CardHeader><CardContent><fieldset disabled={!editable||busy} className="grid gap-5 md:grid-cols-2"><Field label="Score domicile"><Input type="number" min={0} value={form.scoreHome??0} onChange={(e)=>set('scoreHome',e.target.value)}/></Field><Field label="Score extérieur"><Input type="number" min={0} value={form.scoreAway??0} onChange={(e)=>set('scoreAway',e.target.value)}/></Field><Field label="Date et heure"><Input type="datetime-local" value={form.date||''} onChange={(e)=>set('date',e.target.value)}/></Field><Field label="Statut"><select className="h-11 w-full rounded-md border bg-background px-3" value={form.statut||'Brouillon'} onChange={(e)=>set('statut',e.target.value)}>{['Brouillon','Programmé','En Cours','À Valider','Reporté','Annulé','Abandonné','Forfait','Replay Ordonné'].map(s=><option key={s}>{s}</option>)}</select></Field><Field label="Stade"><Input value={form.stade||''} onChange={(e)=>set('stade',e.target.value)}/></Field><Field label="Ville du stade"><Input value={form.venueCity||''} onChange={(e)=>set('venueCity',e.target.value)}/></Field><Field label="Spectateurs"><Input type="number" min={0} value={form.spectateurs??''} onChange={(e)=>set('spectateurs',e.target.value)}/></Field><div/><div className="md:col-span-2"><Label>Notes administratives</Label><textarea className="mt-2 min-h-28 w-full rounded-md border bg-background p-3 text-base" value={form.notes||''} onChange={(e)=>set('notes',e.target.value)}/></div><details className="md:col-span-2 rounded-lg border border-amber-300 bg-amber-50/50 p-4 dark:bg-amber-950/10"><summary className="cursor-pointer font-medium">Dérogation au rapprochement score / buts</summary><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Motif"><select className="h-11 w-full rounded-md border bg-background px-3" value={form.overrideReasonCode||''} onChange={(e)=>set('overrideReasonCode',e.target.value)}><option value="">Aucune dérogation</option><option value="FORFEIT">Forfait</option><option value="ADMINISTRATIVE_DECISION">Score administratif</option><option value="LEGACY_IMPORT">Historique incomplet</option><option value="FEDERATION_CORRECTION">Décision fédérale</option></select></Field><Field label="Justification"><Input value={form.overrideExplanation||''} onChange={(e)=>set('overrideExplanation',e.target.value)}/></Field></div></details></fieldset><div className="mt-6 flex justify-end"><Button className="min-h-11" disabled={!editable||busy} onClick={onSave}><Save/>{busy?'Enregistrement…':'Enregistrer le brouillon'}</Button></div>{!editable&&<p className="mt-3 text-sm text-muted-foreground">Ce match est officiel. Rouvrez-le pour effectuer une correction contrôlée.</p>}</CardContent></Card> }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <div><Label>{label}</Label><div className="mt-2">{children}</div></div> }
function EventsPanel({events,clubs,editable,form,setForm,players,editing,onEdit,onCancel,onSave,busy,kind}:{events:any[];clubs:any[];editable:boolean;form:any;setForm:any;players:any[];editing:any;onEdit:(e:any)=>void;onCancel:(e:any)=>void;onSave:()=>void;busy:boolean;kind:string}) { const set=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v})); return <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><Card><CardHeader><CardTitle>{kind==='goals'?'Buts':'Cartons'} enregistrés</CardTitle></CardHeader><CardContent>{events.length===0?<EmptyState title="Aucun événement" description="Ajoutez le premier événement au brouillon du match."/>:<div className="space-y-2">{events.map((e:any)=><div key={e._id} className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center ${e.status==='CANCELLED'?'opacity-55':''}`}><div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-muted font-mono font-bold">{e.minute}{e.stoppageMinute?`+${e.stoppageMinute}`:''}′</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{eventLabels[e.type]||e.type}</strong><Badge variant="outline">{e.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{e.playerId?.prenom} {e.playerId?.nom}{e.playerId?.numeroMaillot?` (#${e.playerId.numeroMaillot})`:''} · {e.clubId?.nom}</p>{(e.cardReason||e.notes)&&<p className="mt-1 text-xs text-muted-foreground">{e.cardReason||e.notes}</p>}</div>{editable&&e.status==='DRAFT'&&<div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Modifier l’événement" onClick={()=>onEdit(e)}><Pencil/></Button><Button size="icon" variant="destructive" aria-label="Annuler l’événement" onClick={()=>onCancel(e)}><Trash2/></Button></div>}</div>)}</div>}</CardContent></Card><Card><CardHeader><CardTitle>{editing?'Modifier':'Ajouter'} {kind==='goals'?'un but':'un carton'}</CardTitle></CardHeader><CardContent><fieldset disabled={!editable||busy} className="space-y-4"><Field label="Type"><select className="h-11 w-full rounded-md border bg-background px-3" value={form.type} onChange={(e)=>set('type',e.target.value)}>{(kind==='goals'?goalTypes:cardTypes).map(t=><option key={t} value={t}>{eventLabels[t]}</option>)}</select></Field><Field label="Club"><select className="h-11 w-full rounded-md border bg-background px-3" value={form.clubId} onChange={(e)=>set('clubId',e.target.value)}><option value="">Sélectionner</option>{clubs.map((c:any)=><option key={c._id} value={c._id}>{c.nom}</option>)}</select></Field><Field label="Joueur"><select className="h-11 w-full rounded-md border bg-background px-3" value={form.playerId} onChange={(e)=>set('playerId',e.target.value)}><option value="">Sélectionner</option>{players.map(p=><option key={p._id} value={p._id}>{p.prenom} {p.nom}{p.numeroMaillot?` #${p.numeroMaillot}`:''}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Minute"><Input type="number" min={0} max={130} value={form.minute} onChange={(e)=>set('minute',e.target.value)}/></Field><Field label="Temps additionnel"><Input type="number" min={0} max={30} value={form.stoppageMinute} onChange={(e)=>set('stoppageMinute',e.target.value)}/></Field></div>{kind==='goals'?<Field label="Passeur (facultatif)"><select className="h-11 w-full rounded-md border bg-background px-3" value={form.assistPlayerId} onChange={(e)=>set('assistPlayerId',e.target.value)}><option value="">Aucun</option>{players.map(p=><option key={p._id} value={p._id}>{p.prenom} {p.nom}</option>)}</select></Field>:<><Field label="Motif"><Input value={form.cardReason} onChange={(e)=>set('cardReason',e.target.value)} placeholder="Anti-jeu, contestation, conduite violente…"/></Field><Field label="Référence du rapport"><Input value={form.reportReference} onChange={(e)=>set('reportReference',e.target.value)}/></Field></>}<Field label="Notes"><textarea className="min-h-24 w-full rounded-md border bg-background p-3 text-base" value={form.notes} onChange={(e)=>set('notes',e.target.value)}/></Field><Button className="min-h-11 w-full" disabled={!form.clubId||!form.playerId||busy} onClick={onSave}><Plus/>{busy?'Enregistrement…':editing?'Enregistrer les modifications':'Ajouter au brouillon'}</Button></fieldset></CardContent></Card></div> }
function DisciplinePanel({impact}:{impact:any}) { if(!impact)return <div className="space-y-3"><Skeleton className="h-24"/><Skeleton className="h-52"/></div>; return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(impact.summary).map(([k,v])=><Card key={k}><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="mt-1 text-2xl font-bold">{String(v)}</p></CardContent></Card>)}</div><Card><CardHeader><CardTitle>Suspensions générées</CardTitle></CardHeader><CardContent>{impact.suspensions.length===0?<EmptyState title="Aucune suspension générée"/>:<div className="space-y-2">{impact.suspensions.map((s:any)=><Link key={s._id} href={`/admin/discipline/suspensions/${s._id}`} className="flex min-h-14 items-center justify-between rounded-lg border p-3 hover:bg-muted/50"><span><strong>{s.joueurId?.prenom} {s.joueurId?.nom}</strong><small className="block text-muted-foreground">{s.clubId?.nom} · {s.suspensionType}</small></span><span className="text-right text-sm">{s.matchesServed} purgé(s)<br/><strong>{s.matchesRemaining} restant(s)</strong></span></Link>)}</div>}</CardContent></Card><Card><CardHeader><CardTitle>Registre de purge et anomalies</CardTitle></CardHeader><CardContent className="space-y-3">{impact.servingEntries.map((e:any)=><div key={e._id} className="rounded-lg border p-3 text-sm">{e.joueurId?.prenom} {e.joueurId?.nom} · {e.reason} · {e.counted?'Compté':'Non compté'}{e.reversedAt?' · Inversé':''}</div>)}{impact.anomalies.map((a:any)=><div key={a._id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4"/>{a.type} · {a.status}</div>)}</CardContent></Card></div> }
function OfficialsPanel({ match, publishedOfficials }: { match: any; publishedOfficials: any }) {
  const roleLabel: Record<string, string> = {
    MAIN: 'Arbitre Principal',
    ASSISTANT_1: 'Arbitre Assistant 1',
    ASSISTANT_2: 'Arbitre Assistant 2',
    FOURTH: '4e Arbitre',
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Désignation des arbitres</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {publishedOfficials
                ? `Version ${publishedOfficials.version} — ${
                    publishedOfficials.status === 'PUBLISHED' ? 'Publiée' : 'Mise à jour'
                  }`
                : 'Aucune désignation publiée pour ce match'}
            </p>
          </div>
          <Link
            href={`/admin/competitions/${match.competitionId?._id}/rounds/${match.roundId}/`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Gérer les désignations
          </Link>
        </CardHeader>
        <CardContent>
          {publishedOfficials ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Publiée le{' '}
                {new Date(publishedOfficials.publishedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
              <div className="divide-y rounded-lg border">
                {publishedOfficials.referees.map((ref: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{ref.displayName}</p>
                        {ref.categorie && (
                          <p className="text-xs text-muted-foreground">{ref.categorie}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={ref.role === 'MAIN' ? 'default' : 'secondary'} className="text-xs">
                      {roleLabel[ref.role] ?? ref.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <UserRound className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">Aucun corps arbitral désigné</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Utilisez l&apos;onglet de la journée pour publier les désignations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {!publishedOfficials && match.arbitrePrincipalId && (
        <Card className="border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Données legacy (non versionné)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Arbitre : <strong>{match.arbitrePrincipalId.prenom} {match.arbitrePrincipalId.nom}</strong>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ces données proviennent de l&apos;ancienne saisie directe. Veuillez republier via le module de désignation.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
