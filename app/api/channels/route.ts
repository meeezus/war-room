import { NextResponse } from 'next/server'
import { getCategories, getChannels, createCategory, createChannel } from '@/lib/channels'

export async function GET() {
  try {
    const [categories, channels] = await Promise.all([
      getCategories(),
      getChannels(),
    ])
    return NextResponse.json({ categories, channels })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.type === 'category') {
      const category = await createCategory(body.name)
      return NextResponse.json(category)
    }

    if (body.type === 'channel') {
      const channel = await createChannel(
        body.name,
        body.categoryId ?? null,
        body.createdBy ?? 'user',
        body.description
      )
      return NextResponse.json(channel)
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
