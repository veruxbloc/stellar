import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const supabase = createAdminClient();

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_open_projects",
      description: "Lista los proyectos abiertos disponibles en la plataforma con su monto y deadline",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_platform_stats",
      description: "Obtiene estadísticas generales: total proyectos, proyectos completados y estudiantes activos",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "find_students",
      description: "Busca estudiantes por carrera o especialidad",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "Palabra clave para buscar (ej: React, diseño, ingeniería)",
          },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_applications",
      description: "Lista las postulaciones de estudiantes a proyectos, con su score de match",
      parameters: {
        type: "object",
        properties: {
          project_title: {
            type: "string",
            description: "Título o parte del título del proyecto (opcional)",
          },
        },
      },
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  switch (name) {
    case "get_open_projects": {
      const { data } = await supabase
        .from("projects")
        .select("title, description, amount_rbtc, deadline_days, status, companies(name)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!data || data.length === 0) return "No hay proyectos abiertos en este momento.";
      return data
        .map((p) => `• ${p.title} — ${p.amount_rbtc} tRBTC — ${p.deadline_days} días`)
        .join("\n");
    }

    case "get_platform_stats": {
      const [{ count: total }, { count: completed }, { data: certs }] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("certificates").select("student_id"),
      ]);
      const activeStudents = certs ? new Set(certs.map((c) => c.student_id)).size : 0;
      return `Total proyectos: ${total ?? 0}\nProyectos completados: ${completed ?? 0}\nEstudiantes activos: ${activeStudents}`;
    }

    case "find_students": {
      const { data } = await supabase
        .from("students")
        .select("name, university, career")
        .ilike("career", `%${args.keyword ?? ""}%`)
        .limit(5);
      if (!data || data.length === 0) return `No se encontraron estudiantes con la especialidad "${args.keyword}".`;
      return data.map((s) => `• ${s.name} — ${s.career} — ${s.university ?? "Sin universidad"}`).join("\n");
    }

    case "get_applications": {
      let query = supabase
        .from("applications")
        .select("match_score, match_reason, status, students(name), projects(title)")
        .order("match_score", { ascending: false })
        .limit(10);

      if (args.project_title) {
        const { data: proj } = await supabase
          .from("projects")
          .select("id")
          .ilike("title", `%${args.project_title}%`)
          .limit(1)
          .single();
        if (proj) query = query.eq("project_id", proj.id);
      }

      const { data } = await query;
      if (!data || data.length === 0) return "No hay postulaciones registradas.";
      return data
        .map((a) => {
          const student = Array.isArray(a.students) ? a.students[0] : a.students;
          const project = Array.isArray(a.projects) ? a.projects[0] : a.projects;
          return `• ${student?.name ?? "?"} → ${project?.title ?? "?"} — Match: ${a.match_score ?? "N/A"}/100 — ${a.status}`;
        })
        .join("\n");
    }

    default:
      return "Herramienta no reconocida.";
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos el asistente de Verus, una plataforma que conecta empresas con estudiantes mediante contratos de escrow en RSK blockchain.
Podés consultar proyectos, estadísticas, estudiantes y postulaciones usando las herramientas disponibles.
Siempre consultá la base de datos antes de responder preguntas sobre datos de la plataforma.
Respondé en español, de forma concisa y clara.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Tool calling loop — máximo 5 iteraciones para evitar loops infinitos
    for (let i = 0; i < 5; i++) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: chatMessages,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      const data = await res.json();
      const choice = data.choices?.[0];

      if (!choice) throw new Error("No response from model");

      const message = choice.message;
      chatMessages.push(message);

      // Si el modelo no quiere usar tools, devolvemos la respuesta final
      if (choice.finish_reason !== "tool_calls" || !message.tool_calls?.length) {
        return NextResponse.json({ response: message.content ?? "Sin respuesta." });
      }

      // Ejecutar cada tool call y agregar los resultados
      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments ?? "{}");
        const result = await executeTool(toolCall.function.name, args);

        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    return NextResponse.json({ response: "No pude completar la consulta." });
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json({ response: "Error al procesar la consulta." }, { status: 500 });
  }
}
