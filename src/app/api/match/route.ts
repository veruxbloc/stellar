import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { projectDescription, certificates } = await req.json();

  const certSummary = certificates.length > 0
    ? certificates
        .map((c: { name?: string; institution?: string; year?: number; pdf_url?: string }) => {
          const name = c.name ?? (c.pdf_url ? c.pdf_url.split("/").pop() : "Certificado");
          return `- ${name}${c.institution ? ` de ${c.institution}` : ""}${c.year ? ` (${c.year})` : ""}`;
        })
        .join("\n")
    : "- Sin certificados registrados";

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
