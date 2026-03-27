# Escrow Full Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete escrow flow: empresa crea proyecto en RSK → estudiante ve proyectos y se postula → empresa libera pago → estudiante recibe NFT mock.

**Architecture:** Ethers.js (via window.ethereum/Beexo) calls the deployed EscrowProject contract on RSK testnet. Supabase stores project metadata + tx_hash. Next.js pages handle each user role. No new abstractions beyond what's needed.

**Tech Stack:** Next.js 15, ethers@6, Supabase, xo-connect/MetaMask, Tailwind, Recharts (university view)

**Contract address:** `0x1aE5Ae84dDb18e0767033B316B2fe0F5B0f1A376` (RSK testnet chainId 31)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `docs/supabase-projects-migration.sql` | Create | SQL to add projects + applications tables |
| `src/lib/escrow.ts` | Create | Contract ABI + address constant |
| `src/app/company/jobs/page.tsx` | Modify | Add "Crear Proyecto Escrow" modal |
| `src/app/student/projects/page.tsx` | Create | Student sees open projects + IA match |
| `src/app/api/match/route.ts` | Create | GPT-4o mini match score API |
| `src/app/company/projects/page.tsx` | Create | Company manages projects + releases payment |
| `src/app/student/certificates/page.tsx` | Modify | Add NFT mock button (mark verified) |
| `src/app/university/page.tsx` | Create | University dashboard with Recharts |
| `src/app/company/dashboard/page.tsx` | Modify | Add link to /company/projects |
| `src/app/student/dashboard/page.tsx` | Modify | Add link to /student/projects |

---

## Task 1: Supabase — agregar tabla `projects` y `applications`

**Files:**
- Create: `docs/supabase-projects-migration.sql`

- [ ] **Step 1: Crear el archivo SQL**

```sql
-- Ejecutar en Supabase Dashboard → SQL Editor

-- Tabla de proyectos con escrow en RSK
create table if not exists public.projects (
  id bigserial primary key,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text,
  amount_rbtc numeric not null,
  deadline_days int not null,
  student_wallet text,
  contract_project_id int,
  tx_hash text,
  status text default 'open' check (status in ('open', 'active', 'delivered', 'completed', 'disputed')),
  created_at timestamptz default now()
);

-- Tabla de postulaciones
create table if not exists public.applications (
  id bigserial primary key,
  project_id bigint references public.projects(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  match_score int,
  match_reason text,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now()
);

-- RLS
alter table public.projects enable row level security;
alter table public.applications enable row level security;

-- Empresas gestionan sus proyectos
create policy "projects: company manage" on public.projects for all using (
  company_id in (select id from public.companies where user_id = auth.uid())
);
-- Todos leen proyectos abiertos
create policy "projects: all read" on public.projects for select using (true);

-- Estudiantes gestionan sus postulaciones
create policy "applications: student manage" on public.applications for all using (
  student_id in (select id from public.students where user_id = auth.uid())
);
-- Empresas leen postulaciones de sus proyectos
create policy "applications: company read" on public.applications for select using (
  project_id in (
    select id from public.projects where company_id in (
      select id from public.companies where user_id = auth.uid()
    )
  )
);
```

- [ ] **Step 2: Ejecutar en Supabase**

Ir a Supabase Dashboard → SQL Editor → pegar el contenido → Run.

- [ ] **Step 3: Verificar**

En Supabase → Table Editor, confirmar que aparecen tablas `projects` y `applications`.

- [ ] **Step 4: Commit**

```bash
git add docs/supabase-projects-migration.sql
git commit -m "feat: add projects and applications tables SQL migration"
```

---

## Task 2: Constante del contrato + ABI

**Files:**
- Create: `src/lib/escrow.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
export const ESCROW_ADDRESS = "0x1aE5Ae84dDb18e0767033B316B2fe0F5B0f1A376";
export const RSK_TESTNET_CHAIN_ID = "0x1f"; // 31 en hex

export const ESCROW_ABI = [
  "function createProject(address payable _student, uint256 _deadline, string calldata _title, string calldata _description) external payable returns (uint256)",
  "function assignStudent(uint256 id, address payable _student) external",
  "function deliverWork(uint256 id) external",
  "function approveAndRelease(uint256 id) external",
  "function getProject(uint256 id) external view returns (tuple(address company, address student, uint256 amount, uint256 deadline, uint8 status, string title, string description))",
  "event ProjectCreated(uint256 indexed id, address company, uint256 amount, string title)",
  "event FundsReleased(uint256 indexed id, address student, uint256 amount)",
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/escrow.ts
git commit -m "feat: add escrow contract ABI and address"
```

---

## Task 3: Empresa crea proyecto escrow en `/company/jobs`

**Files:**
- Modify: `src/app/company/jobs/page.tsx`

- [ ] **Step 1: Agregar imports al tope del archivo**

Reemplazar los imports existentes con:

```typescript
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ESCROW_ADDRESS, ESCROW_ABI, RSK_TESTNET_CHAIN_ID } from "@/lib/escrow";
import { ArrowLeft, Briefcase, Plus, Trash2, X, Coins, ExternalLink } from "lucide-react";
```

- [ ] **Step 2: Agregar interface Project y estado después de los estados existentes**

Agregar después de `const [deletingId, setDeletingId] = useState<string | null>(null);`:

```typescript
// Escrow project state
interface EscrowProject {
  id: number;
  title: string;
  description: string;
  amount_rbtc: number;
  deadline_days: number;
  tx_hash: string | null;
  contract_project_id: number | null;
  status: string;
  created_at: string;
}

const [escrowProjects, setEscrowProjects] = useState<EscrowProject[]>([]);
const [showEscrowForm, setShowEscrowForm] = useState(false);
const [escrowTitle, setEscrowTitle] = useState("");
const [escrowDescription, setEscrowDescription] = useState("");
const [escrowAmount, setEscrowAmount] = useState("0.0001");
const [escrowDays, setEscrowDays] = useState("30");
const [escrowSubmitting, setEscrowSubmitting] = useState(false);
const [escrowError, setEscrowError] = useState("");
```

- [ ] **Step 3: Cargar proyectos escrow en fetchCompanyAndJobs**

Dentro de `fetchCompanyAndJobs`, después de cargar `jobsData`, agregar:

```typescript
const { data: projectsData } = await supabase
  .from("projects")
  .select("id, title, description, amount_rbtc, deadline_days, tx_hash, contract_project_id, status, created_at")
  .eq("company_id", companyData.id)
  .order("created_at", { ascending: false });

setEscrowProjects((projectsData as EscrowProject[]) ?? []);
```

- [ ] **Step 4: Agregar función handleCreateEscrow antes del return**

```typescript
async function handleCreateEscrow(e: React.FormEvent) {
  e.preventDefault();
  if (!companyId) return;
  setEscrowSubmitting(true);
  setEscrowError("");

  try {
    const win = window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } };
    if (!win.ethereum) throw new Error("Instalá MetaMask o usá Beexo desde el celular.");

    // Verificar red RSK testnet
    const chainId = await win.ethereum.request({ method: "eth_chainId" }) as string;
    if (chainId !== RSK_TESTNET_CHAIN_ID) {
      await win.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: RSK_TESTNET_CHAIN_ID }],
      }).catch(async () => {
        await win.ethereum!.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: RSK_TESTNET_CHAIN_ID,
            chainName: "RSK Testnet",
            nativeCurrency: { name: "tRBTC", symbol: "tRBTC", decimals: 18 },
            rpcUrls: ["https://public-node.testnet.rsk.co"],
            blockExplorerUrls: ["https://explorer.testnet.rsk.co"],
          }],
        });
      });
    }

    const provider = new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

    const deadlineTimestamp = Math.floor(Date.now() / 1000) + parseInt(escrowDays) * 86400;
    const amountWei = ethers.parseEther(escrowAmount);

    const tx = await contract.createProject(
      ethers.ZeroAddress,
      deadlineTimestamp,
      escrowTitle.trim(),
      escrowDescription.trim(),
      { value: amountWei }
    );

    const receipt = await tx.wait();

    // Extraer contract_project_id del evento ProjectCreated
    const iface = new ethers.Interface(ESCROW_ABI);
    let contractProjectId: number | null = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "ProjectCreated") {
          contractProjectId = Number(parsed.args[0]);
          break;
        }
      } catch { /* skip */ }
    }

    // Guardar en Supabase
    const { data, error } = await supabase
      .from("projects")
      .insert({
        company_id: companyId,
        title: escrowTitle.trim(),
        description: escrowDescription.trim(),
        amount_rbtc: parseFloat(escrowAmount),
        deadline_days: parseInt(escrowDays),
        tx_hash: receipt.hash,
        contract_project_id: contractProjectId,
        status: "open",
      })
      .select()
      .single();

    if (error || !data) throw new Error("Error guardando en base de datos.");

    setEscrowProjects((prev) => [data as EscrowProject, ...prev]);
    setEscrowTitle("");
    setEscrowDescription("");
    setEscrowAmount("0.0001");
    setEscrowDays("30");
    setShowEscrowForm(false);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    setEscrowError(msg.includes("user rejected") ? "Transacción rechazada." : msg);
  } finally {
    setEscrowSubmitting(false);
  }
}
```

- [ ] **Step 5: Agregar sección UI de proyectos escrow en el JSX**

Dentro de `<main>`, después de la sección de `{/* Job list */}`, agregar:

```tsx
{/* Escrow Projects Section */}
<div className="mt-10">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
      <Coins className="h-5 w-5 text-orange-500" />
      Proyectos con Escrow RSK
    </h2>
    <Button size="sm" onClick={() => setShowEscrowForm((v) => !v)} className="gap-1.5 bg-orange-500 hover:bg-orange-600">
      {showEscrowForm ? <><X className="h-4 w-4" />Cancelar</> : <><Plus className="h-4 w-4" />Nuevo proyecto</>}
    </Button>
  </div>

  {showEscrowForm && (
    <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">Crear proyecto con escrow</h3>
      <p className="text-sm text-slate-500 mb-5">El monto quedará bloqueado en RSK hasta que apruebes la entrega.</p>
      <form onSubmit={handleCreateEscrow} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Título <span className="text-red-500">*</span></label>
          <input type="text" required value={escrowTitle} onChange={(e) => setEscrowTitle(e.target.value)}
            placeholder="Ej: App móvil de delivery" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción <span className="text-red-500">*</span></label>
          <textarea required value={escrowDescription} onChange={(e) => setEscrowDescription(e.target.value)}
            rows={3} placeholder="Describí el proyecto y los requisitos..."
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monto (tRBTC) <span className="text-red-500">*</span></label>
            <input type="number" step="0.0001" min="0.0001" required value={escrowAmount} onChange={(e) => setEscrowAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deadline (días) <span className="text-red-500">*</span></label>
            <input type="number" min="1" required value={escrowDays} onChange={(e) => setEscrowDays(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
        {escrowError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{escrowError}</p>}
        <Button type="submit" isLoading={escrowSubmitting} className="bg-orange-500 hover:bg-orange-600">
          Fondear proyecto en RSK
        </Button>
      </form>
    </div>
  )}

  {escrowProjects.length === 0 ? (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
      <Coins className="h-10 w-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500">Todavía no creaste proyectos con escrow.</p>
    </div>
  ) : (
    <div className="space-y-4">
      {escrowProjects.map((p) => (
        <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">{p.title}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">{p.status}</span>
              </div>
              <p className="text-slate-500 text-sm mt-1 line-clamp-2">{p.description}</p>
              <p className="text-sm font-medium text-orange-600 mt-2">{p.amount_rbtc} tRBTC · {p.deadline_days} días</p>
              {p.tx_hash && (
                <a href={`https://explorer.testnet.rsk.co/tx/${p.tx_hash}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                  <ExternalLink className="h-3 w-3" />Ver en RSK Explorer
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/app/company/jobs/page.tsx
git commit -m "feat: add escrow project creation with RSK blockchain call"
```

---

## Task 4: Match IA — API route

**Files:**
- Create: `src/app/api/match/route.ts`

- [ ] **Step 1: Verificar que OPENAI_API_KEY esté en .env.local**

```bash
grep OPENAI_API_KEY .env.local || echo "FALTA — agregar OPENAI_API_KEY=sk-..."
```

Si falta, agregar al `.env.local`:
```
OPENAI_API_KEY=sk-tu-clave-aqui
```

- [ ] **Step 2: Crear la API route**

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { projectDescription, certificates } = await req.json();

  const certSummary = certificates
    .map((c: { name?: string; institution?: string; year?: number }) =>
      `- ${c.name ?? "Certificado"} de ${c.institution ?? "institución"} (${c.year ?? "s/f"})`
    )
    .join("\n");

  const prompt = `Eres un evaluador de talento técnico. Dado un proyecto y los certificados de un estudiante, devuelve un JSON con:
- "score": número del 0 al 100 indicando compatibilidad
- "reason": string de máximo 2 oraciones explicando el puntaje

Proyecto: ${projectDescription}

Certificados del estudiante:
${certSummary}

Responde SOLO con el JSON, sin texto extra.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '{"score":50,"reason":"Sin datos suficientes."}';

  try {
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ score: 50, reason: "Error al calcular compatibilidad." });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/match/route.ts
git commit -m "feat: add GPT-4o mini match API route"
```

---

## Task 5: Estudiante ve proyectos disponibles con match IA

**Files:**
- Create: `src/app/student/projects/page.tsx`

- [ ] **Step 1: Crear la página**

```typescript
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Coins, ExternalLink, Zap } from "lucide-react";

interface Project {
  id: number;
  title: string;
  description: string;
  amount_rbtc: number;
  deadline_days: number;
  tx_hash: string | null;
  status: string;
  companies: { name: string } | null;
}

interface MatchResult {
  score: number;
  reason: string;
}

export default function StudentProjectsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<{ name?: string; institution?: string; year?: number }[]>([]);
  const [matches, setMatches] = useState<Record<number, MatchResult>>({});
  const [matchingId, setMatchingId] = useState<number | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      setDataLoading(true);

      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (studentData) {
        setStudentId(studentData.id);

        const { data: certs } = await supabase
          .from("certificates")
          .select("name, institution, year")
          .eq("student_id", studentData.id);

        setCertificates(certs ?? []);

        const { data: myApps } = await supabase
          .from("applications")
          .select("project_id")
          .eq("student_id", studentData.id);

        if (myApps) setApplied(new Set(myApps.map((a) => a.project_id)));
      }

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, title, description, amount_rbtc, deadline_days, tx_hash, status, companies(name)")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      setProjects((projectsData as Project[]) ?? []);
      setDataLoading(false);
    }

    fetchData();
  }, [user, supabase]);

  async function handleMatch(project: Project) {
    setMatchingId(project.id);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectDescription: project.description, certificates }),
      });
      const data: MatchResult = await res.json();
      setMatches((prev) => ({ ...prev, [project.id]: data }));
    } finally {
      setMatchingId(null);
    }
  }

  async function handleApply(project: Project) {
    if (!studentId) return;
    setApplying(project.id);

    const match = matches[project.id];
    await supabase.from("applications").insert({
      project_id: project.id,
      student_id: studentId,
      match_score: match?.score ?? null,
      match_reason: match?.reason ?? null,
      status: "pending",
    });

    setApplied((prev) => new Set([...prev, project.id]));
    setApplying(null);
  }

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Cargando proyectos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/student/dashboard" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Coins className="h-5 w-5 text-orange-500" />
          <span className="font-bold text-slate-900">Proyectos disponibles</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <Coins className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No hay proyectos disponibles por ahora.</p>
          </div>
        ) : (
          projects.map((project) => {
            const match = matches[project.id];
            const isApplied = applied.has(project.id);

            return (
              <div key={project.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{project.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{project.companies?.name}</p>
                    <p className="text-slate-500 text-sm mt-2 line-clamp-3">{project.description}</p>
                    <p className="text-sm font-medium text-orange-600 mt-2">{project.amount_rbtc} tRBTC · {project.deadline_days} días</p>

                    {project.tx_hash && (
                      <a href={`https://explorer.testnet.rsk.co/tx/${project.tx_hash}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                        <ExternalLink className="h-3 w-3" />Ver escrow en RSK
                      </a>
                    )}

                    {match && (
                      <div className="mt-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                        <p className="text-sm font-semibold text-violet-700">Match: {match.score}/100</p>
                        <p className="text-xs text-violet-600 mt-0.5">{match.reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {!match && (
                    <Button size="sm" variant="secondary" onClick={() => handleMatch(project)}
                      isLoading={matchingId === project.id} className="gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      Ver mi match
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleApply(project)}
                    isLoading={applying === project.id}
                    disabled={isApplied}
                    className={isApplied ? "bg-slate-300 cursor-not-allowed" : ""}>
                    {isApplied ? "Postulado" : "Postularme"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/student/projects/page.tsx
git commit -m "feat: student projects page with AI match and apply"
```

---

## Task 6: Empresa gestiona proyectos y libera pago

**Files:**
- Create: `src/app/company/projects/page.tsx`

- [ ] **Step 1: Crear la página**

```typescript
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ESCROW_ADDRESS, ESCROW_ABI } from "@/lib/escrow";
import { ArrowLeft, Coins, ExternalLink, CheckCircle } from "lucide-react";

interface Application {
  id: number;
  student_id: string;
  match_score: number | null;
  match_reason: string | null;
  status: string;
  students: { name: string; user_id: string } | null;
}

interface Project {
  id: number;
  title: string;
  description: string;
  amount_rbtc: number;
  deadline_days: number;
  tx_hash: string | null;
  contract_project_id: number | null;
  status: string;
  student_wallet: string | null;
  applications: Application[];
}

export default function CompanyProjectsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [releasing, setReleasing] = useState<number | null>(null);
  const [releaseError, setReleaseError] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchProjects() {
      setDataLoading(true);

      const { data: companyData } = await supabase
        .from("companies").select("id").eq("user_id", user!.id).single();

      if (!companyData) { setDataLoading(false); return; }

      const { data } = await supabase
        .from("projects")
        .select(`id, title, description, amount_rbtc, deadline_days, tx_hash, contract_project_id, status, student_wallet,
          applications(id, student_id, match_score, match_reason, status, students(name, user_id))`)
        .eq("company_id", companyData.id)
        .order("created_at", { ascending: false });

      setProjects((data as Project[]) ?? []);
      setDataLoading(false);
    }

    fetchProjects();
  }, [user, supabase]);

  async function handleAcceptApplicant(project: Project, application: Application) {
    const win = window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } };
    if (!win.ethereum || project.contract_project_id === null) return;

    // Obtener wallet del estudiante
    const { data: userData } = await supabase
      .from("users").select("wallet_address").eq("id", application.students?.user_id ?? "").single();

    const studentWallet = userData?.wallet_address;
    if (!studentWallet) {
      alert("El estudiante no tiene wallet conectada.");
      return;
    }

    const provider = new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

    const tx = await contract.assignStudent(project.contract_project_id, studentWallet);
    await tx.wait();

    await supabase.from("applications").update({ status: "accepted" }).eq("id", application.id);
    await supabase.from("projects").update({ status: "active", student_wallet: studentWallet }).eq("id", project.id);

    setProjects((prev) => prev.map((p) =>
      p.id === project.id ? { ...p, status: "active", student_wallet: studentWallet } : p
    ));
  }

  async function handleRelease(project: Project) {
    if (project.contract_project_id === null) return;
    setReleasing(project.id);
    setReleaseError((prev) => ({ ...prev, [project.id]: "" }));

    try {
      const win = window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } };
      if (!win.ethereum) throw new Error("Instalá MetaMask o usá Beexo.");

      const provider = new ethers.BrowserProvider(win.ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

      const tx = await contract.approveAndRelease(project.contract_project_id);
      await tx.wait();

      await supabase.from("projects").update({ status: "completed" }).eq("id", project.id);
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status: "completed" } : p));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      setReleaseError((prev) => ({ ...prev, [project.id]: msg.includes("user rejected") ? "Rechazado." : msg }));
    } finally {
      setReleasing(null);
    }
  }

  if (loading || dataLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/company/dashboard" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="h-5 w-5" /></Link>
          <Coins className="h-5 w-5 text-orange-500" />
          <span className="font-bold text-slate-900">Gestionar proyectos escrow</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-slate-500">No tenés proyectos todavía. Creá uno desde Ofertas laborales.</p>
          </div>
        ) : projects.map((project) => (
          <div key={project.id} className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-900">{project.title}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                project.status === "completed" ? "bg-green-100 text-green-700" :
                project.status === "active" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
              }`}>{project.status}</span>
            </div>
            <p className="text-sm font-medium text-orange-600">{project.amount_rbtc} tRBTC</p>
            {project.tx_hash && (
              <a href={`https://explorer.testnet.rsk.co/tx/${project.tx_hash}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                <ExternalLink className="h-3 w-3" />Ver TX en RSK Explorer
              </a>
            )}

            {/* Postulaciones */}
            {project.applications.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Postulantes</p>
                <div className="space-y-2">
                  {project.applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{app.students?.name}</p>
                        {app.match_score !== null && (
                          <p className="text-xs text-violet-600">Match: {app.match_score}/100 · {app.match_reason}</p>
                        )}
                      </div>
                      {project.status === "open" && app.status === "pending" && (
                        <Button size="sm" onClick={() => handleAcceptApplicant(project, app)}>Aceptar</Button>
                      )}
                      {app.status === "accepted" && (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />Aceptado</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Liberar pago */}
            {(project.status === "active" || project.status === "delivered") && (
              <div className="mt-4">
                {releaseError[project.id] && (
                  <p className="text-xs text-red-600 mb-2">{releaseError[project.id]}</p>
                )}
                <Button onClick={() => handleRelease(project)} isLoading={releasing === project.id}
                  className="bg-green-600 hover:bg-green-700 gap-1.5">
                  <CheckCircle className="h-4 w-4" />Aprobar y liberar pago
                </Button>
              </div>
            )}

            {project.status === "completed" && (
              <p className="mt-4 text-sm text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />Pago liberado al estudiante
              </p>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/company/projects/page.tsx
git commit -m "feat: company projects management page with release payment"
```

---

## Task 7: NFT mock — marcar certificado como verificado

**Files:**
- Modify: `src/app/student/certificates/page.tsx`

- [ ] **Step 1: Buscar la interfaz Certificate en el archivo**

Leer `src/app/student/certificates/page.tsx` y agregar `verified` y `nft_token_id` a la interfaz Certificate:

```typescript
interface Certificate {
  id: string;
  pdf_url: string;
  nft_token_id: string | null;
  tx_hash: string | null;
  chain: string;
  verified?: boolean;    // agregar
  created_at: string;
}
```

- [ ] **Step 2: Agregar función handleMintNFT antes del return**

```typescript
async function handleMintNFT(certId: string) {
  const nftTokenId = `verus-nft-${certId}`;
  const { error } = await supabase
    .from("certificates")
    .update({ verified: true, nft_token_id: nftTokenId })
    .eq("id", certId);

  if (!error) {
    setCertificates((prev) =>
      prev.map((c) => c.id === certId ? { ...c, verified: true, nft_token_id: nftTokenId } : c)
    );
  }
}
```

- [ ] **Step 3: Agregar botón NFT en cada certificado en el JSX**

Dentro del map de certificados, después de mostrar el `tx_hash`, agregar:

```tsx
{!cert.verified ? (
  <Button size="sm" variant="secondary" onClick={() => handleMintNFT(cert.id)}
    className="mt-2 gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50">
    🏅 Recibir NFT badge
  </Button>
) : (
  <p className="text-xs text-violet-600 font-medium mt-2">🏅 NFT: {cert.nft_token_id}</p>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/student/certificates/page.tsx
git commit -m "feat: NFT mock badge for verified certificates"
```

---

## Task 8: Agregar links de navegación en dashboards

**Files:**
- Modify: `src/app/company/dashboard/page.tsx`
- Modify: `src/app/student/dashboard/page.tsx`

- [ ] **Step 1: En company dashboard, agregar link a /company/projects**

Dentro de las Navigation cards (después del link a `/company/students`), agregar:

```tsx
<Link
  href="/company/projects"
  className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-orange-300 hover:shadow-md transition-all group"
>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="bg-orange-100 rounded-xl p-2.5">
        <Coins className="h-5 w-5 text-orange-500" />
      </div>
      <div>
        <p className="font-semibold text-slate-900">Proyectos escrow</p>
        <p className="text-sm text-slate-500 mt-0.5">Gestioná pagos en RSK</p>
      </div>
    </div>
    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
  </div>
</Link>
```

Agregar `Coins` a los imports de lucide-react.

- [ ] **Step 2: En student dashboard, agregar link a /student/projects**

Dentro de las navigation cards, agregar:

```tsx
<Link
  href="/student/projects"
  className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-orange-300 hover:shadow-md transition-all group"
>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="bg-orange-100 rounded-xl p-2.5">
        <Coins className="h-5 w-5 text-orange-500" />
      </div>
      <div>
        <p className="font-semibold text-slate-900">Proyectos disponibles</p>
        <p className="text-sm text-slate-500 mt-0.5">Encontrá proyectos con escrow</p>
      </div>
    </div>
    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
  </div>
</Link>
```

Agregar `Coins` a los imports de lucide-react en student dashboard.

- [ ] **Step 3: Commit**

```bash
git add src/app/company/dashboard/page.tsx src/app/student/dashboard/page.tsx
git commit -m "feat: add navigation links to escrow project pages"
```

---

## Task 9: Vista Universidad con Recharts

**Files:**
- Create: `src/app/university/page.tsx`

- [ ] **Step 1: Instalar recharts si no está**

```bash
npm list recharts 2>/dev/null | grep recharts || npm install recharts
```

- [ ] **Step 2: Crear la página**

```typescript
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { GraduationCap } from "lucide-react";

const SKILL_GAP_DATA = [
  { skill: "React", demand: 85 },
  { skill: "Solidity", demand: 70 },
  { skill: "UI/UX", demand: 65 },
  { skill: "Python/IA", demand: 90 },
  { skill: "Node.js", demand: 75 },
];

const RETENTION_DATA = [
  { month: "Oct", rate: 60 },
  { month: "Nov", rate: 65 },
  { month: "Dic", rate: 70 },
  { month: "Ene", rate: 72 },
  { month: "Feb", rate: 78 },
  { month: "Mar", rate: 82 },
];

export default function UniversityPage() {
  const supabase = useMemo(() => createClient(), []);
  const [totalProjects, setTotalProjects] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [completedProjects, setCompletedProjects] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [{ count: total }, { count: completed }, { data: students }] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("certificates").select("student_id"),
      ]);

      setTotalProjects(total ?? 0);
      setCompletedProjects(completed ?? 0);
      if (students) {
        const unique = new Set(students.map((s) => s.student_id));
        setActiveStudents(unique.size);
      }
      setLoading(false);
    }
    fetchStats();
  }, [supabase]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-500">Cargando...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-slate-900 text-lg">Dashboard Universidad</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total proyectos", value: totalProjects },
            { label: "Estudiantes activos", value: activeStudents },
            { label: "Proyectos completados", value: completedProjects },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
              <p className="text-3xl font-bold text-slate-900">{kpi.value}</p>
              <p className="text-sm text-slate-500 mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Skill gap */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Demanda de skills del mercado</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={SKILL_GAP_DATA}>
              <XAxis dataKey="skill" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="demand" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Retención */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Retención de estudiantes (%)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={RETENTION_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/university/page.tsx
git commit -m "feat: university dashboard with Recharts"
```

---

## Task 10: Verificar build y hacer deploy en Vercel

**Files:** ninguno nuevo

- [ ] **Step 1: Verificar que no hay errores de TypeScript**

```bash
npm run build 2>&1 | tail -30
```

Corregir cualquier error antes de continuar.

- [ ] **Step 2: Deploy en Vercel**

```bash
npx vercel --prod
```

Si pide login: `npx vercel login` primero.

Configurar variables de entorno en Vercel Dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS`
- `OPENAI_API_KEY`

- [ ] **Step 3: Verificar que la app funciona en el link de Vercel**

Abrir el link público y probar login empresa + crear proyecto.

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "feat: complete hackathon MVP — escrow RSK + NFT mock + university dashboard"
```
