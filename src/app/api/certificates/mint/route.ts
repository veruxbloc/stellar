import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { studentId, pdfUrl } = body

    if (!studentId || !pdfUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId and pdfUrl.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { error: dbError } = await supabase.from('certificates').insert({
      student_id: studentId,
      pdf_url: pdfUrl,
      chain: 'rsk-testnet',
    })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, txHash: '' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
