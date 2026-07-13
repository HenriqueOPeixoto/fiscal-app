import { NextResponse } from 'next/server'
import { hojeISO } from '@/lib/date'

export async function GET() {
  return NextResponse.json({ hoje: hojeISO() })
}
