import { NextRequest, NextResponse } from 'next/server'
import { runOrderEngine } from '@/lib/order-engine'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await runOrderEngine()
  return NextResponse.json(result)
}
