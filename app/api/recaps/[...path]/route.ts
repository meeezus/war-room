import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export const dynamic = 'force-dynamic'

const ALLOWED_DIRS = [
  path.join(os.homedir(), '.agent', 'diagrams'),
  path.join(os.homedir(), 'Shugyo', 'plans'),
]

function isAllowedPath(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  return ALLOWED_DIRS.some(dir => resolved.startsWith(dir + path.sep) || resolved === dir)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filePath = searchParams.get('file')

  if (!filePath) {
    return new NextResponse('Missing file parameter', { status: 400 })
  }

  if (!isAllowedPath(filePath)) {
    return new NextResponse('Access denied', { status: 403 })
  }

  if (!filePath.endsWith('.html')) {
    return new NextResponse('Only HTML files are served', { status: 400 })
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const isNotFound = err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT'
    if (isNotFound) {
      return new NextResponse('File not found', { status: 404 })
    }
    return new NextResponse('Failed to read file', { status: 500 })
  }
}
