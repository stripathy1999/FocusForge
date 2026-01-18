import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // Proxy to backend API
    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL
    let fetchUrl: string
    
    if (backendUrl) {
      fetchUrl = `${backendUrl}/api/opennote/practice/create`
    } else {
      // Same deployment - construct URL from request
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const host = request.headers.get('host') || 'localhost:3000'
      fetchUrl = `${protocol}://${host}/api/opennote/practice/create`
    }

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: errorText || 'Failed to create practice set' },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Unexpected response format: ${contentType}`, details: text.substring(0, 200) },
        { status: 500 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Practice set creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create practice set' },
      { status: 500 }
    )
  }
}