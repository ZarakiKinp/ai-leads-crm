import { NextRequest, NextResponse } from 'next/server'

const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN || 'algosouissi'
const KOMMO_API_KEY = process.env.KOMMO_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImZiMzVjM2YxOTZjMGZmODkyNGFmMGFmNWNhMTRkNjcxMGZjOTU2YjNhYWIxOGFkYjQ4YzIyNmI0ZTc3MzYzNzM0NTFlYmUzYWQ2ODVjNWM0In0.eyJhdWQiOiJhNWU4ZjNhZC0xMWZmLTQzNWMtOWY5Zi0yYjQyOTRmNDMzZDkiLCJqdGkiOiJmYjM1YzNmMTk2YzBmZjg5MjRhZjBhZjVjYTE0ZDY3MTBmYzk1NmIzYWFiMThhZGI0OGMyMjZiNGU3NzM2MzczNDUxZWJlM2FkNjg1YzVjNCIsImlhdCI6MTc2MDU0MDUzNywibmJmIjoxNzYwNTQwNTM3LCJleHAiOjE4MzI5NzYwMDAsInN1YiI6IjgxNzc5ODkiLCJncmFudF90eXBlIjoiIiwiYWNjb3VudF9pZCI6MzAxNjIyMzAsImJhc2VfZG9tYWluIjoia29tbW8uY29tIiwidmVyc2lvbiI6Miwic2NvcGVzIjpbImNybSIsImZpbGVzIiwiZmlsZXNfZGVsZXRlIiwibm90aWZpY2F0aW9ucyIsInB1c2hfbm90aWZpY2F0aW9ucyJdLCJ1c2VyX2ZsYWdzIjowLCJoYXNoX3V1aWQiOiI4YzJhNTZkZi00YjQyLTRhOGUtOWJkYy01YzQ0YjBlZjZjMjYiLCJhcGlfZG9tYWluIjoiYXBpLWcua29tbW8uY29tIn0.m66cOHWUhNzWoHClItIAcG9bqjq5BNgzyEcU4AXz0jOz3Xj_rFl0cQ6aor6uUDqwbxoTddL2SqcGEC8SZmoJGDCfsaafg-hxG5AHsBmoS_z9aP-8bCtOVI5-bjQ8AmfuuuTgO73KPEl6Fi_k4ITavyShp-P_LGcbpaz7CgFhOGMHOKJFHgXEEs17GA4thm9-rIypZDohmqcNQTI-YKsnY9cPeXHZvhenJp5GOvm__iiaC6e3mlXVIvzawt_hkMVHMltKausxeR1mFyQf5KEoVNo6xIs6U8xijLWn9bCXpY_4-HQIriYaPOdtPmaX4jvZz_SoLFFQsM7mOgJrZYn9Uw'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/')
    const url = new URL(request.url)
    const searchParams = url.searchParams.toString()
    
    console.log(`🔄 GET request to: ${path}`)
    console.log('Search params:', searchParams)
    console.log('KOMMO_SUBDOMAIN:', KOMMO_SUBDOMAIN)
    console.log('KOMMO_API_KEY exists:', !!KOMMO_API_KEY)
    
    const kommoUrl = `https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/${path}${searchParams ? `?${searchParams}` : ''}`
    console.log('Kommo URL:', kommoUrl)
    
    const response = await fetch(kommoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KOMMO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    
    console.log(`📡 Kommo API response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Kommo API error: ${response.status} - ${errorText}`)
      console.error('GET Request details:', {
        url: kommoUrl,
        method: 'GET'
      })
      return NextResponse.json(
        { error: `Kommo API error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }
    
    // Handle different response types
    let data
    if (response.status === 204) {
      // No content response
      data = { message: 'No content', status: 204 }
    } else {
      // Try to parse JSON, but handle empty responses
      const text = await response.text()
      if (text.trim() === '') {
        data = { message: 'Empty response', status: response.status }
      } else {
        try {
          data = JSON.parse(text)
        } catch (parseError) {
          console.error('JSON parse error:', parseError)
          console.error('Response text:', text)
          data = { message: 'Invalid JSON response', status: response.status, raw: text }
        }
      }
    }
    
    console.log('✅ Kommo API response:', data)
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  } catch (error) {
    console.error('Kommo API proxy error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    if (errorStack) {
      console.error('Error stack:', errorStack)
    }
    return NextResponse.json(
      { error: `Failed to fetch data from Kommo API: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/')
    const body = await request.json()
    
    console.log(`🔄 POST request to: ${path}`)
    console.log('Request body:', body)
    console.log('KOMMO_SUBDOMAIN:', KOMMO_SUBDOMAIN)
    console.log('KOMMO_API_KEY exists:', !!KOMMO_API_KEY)
    
    const kommoUrl = `https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/${path}`
    console.log('Kommo URL:', kommoUrl)
    
    const response = await fetch(kommoUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KOMMO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    console.log(`📡 Kommo API response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Kommo API error: ${response.status} - ${errorText}`)
      console.error('POST Request details:', {
        url: kommoUrl,
        method: 'POST',
        body: JSON.stringify(body, null, 2)
      })
      return NextResponse.json(
        { error: `Kommo API error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log('✅ Kommo API response:', data)
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  } catch (error) {
    console.error('Kommo API proxy error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    if (errorStack) {
      console.error('Error stack:', errorStack)
    }
    return NextResponse.json(
      { error: `Failed to update data in Kommo API: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/')
    const body = await request.json()
    
    console.log(`🔄 PATCH request to: ${path}`)
    console.log('PATCH request body:', JSON.stringify(body, null, 2))
    console.log('KOMMO_SUBDOMAIN:', KOMMO_SUBDOMAIN)
    console.log('KOMMO_API_KEY exists:', !!KOMMO_API_KEY)
    
    const kommoUrl = `https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/${path}`
    console.log('Kommo URL:', kommoUrl)
    
    const response = await fetch(kommoUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${KOMMO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    console.log(`📡 Kommo API response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Kommo API error: ${response.status} - ${errorText}`)
      console.error('PATCH Request details:', {
        url: kommoUrl,
        method: 'PATCH',
        body: JSON.stringify(body, null, 2)
      })
      return NextResponse.json(
        { error: `Kommo API error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log('✅ Kommo API response:', data)
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  } catch (error) {
    console.error('Kommo API proxy error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    if (errorStack) {
      console.error('Error stack:', errorStack)
    }
    return NextResponse.json(
      { error: `Failed to update data in Kommo API: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
