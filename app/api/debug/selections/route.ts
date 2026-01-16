import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * DEBUG ENDPOINT - Raw Selection Query
 *
 * Tests direct database access to Selection table
 * Usage: /api/debug/selections?billId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const billId = searchParams.get('billId')

    console.log('🔧 [DEBUG] ===== DEBUG SELECTIONS START =====')
    console.log('[DEBUG] Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      SERVICE_ROLE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })

    // Test 1: Count all selections
    console.log('[DEBUG] Test 1: Counting all selections...')
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('Selection')
      .select('*', { count: 'exact', head: true })

    console.log('[DEBUG] Total selections:', totalCount, countError)

    // Test 2: Get all selections (limit 10)
    console.log('[DEBUG] Test 2: Fetching all selections (limit 10)...')
    const { data: allSelections, error: allError } = await supabaseAdmin
      .from('Selection')
      .select('id, billId, friendName, status, paid, paymentMethod')
      .limit(10)

    console.log('[DEBUG] All selections:', {
      count: allSelections?.length || 0,
      data: allSelections,
      error: allError
    })

    // Test 3: Get selections for specific bill (if provided)
    let billSelections = null
    let billError = null
    if (billId) {
      console.log('[DEBUG] Test 3: Fetching selections for billId:', billId)
      const result = await supabaseAdmin
        .from('Selection')
        .select('*')
        .eq('billId', billId)

      billSelections = result.data
      billError = result.error

      console.log('[DEBUG] Bill selections:', {
        billId,
        count: billSelections?.length || 0,
        data: billSelections,
        error: billError
      })
    }

    // Test 4: Get selections with SELECTING status only
    console.log('[DEBUG] Test 4: Fetching SELECTING selections...')
    const { data: selectingOnly, error: selectingError } = await supabaseAdmin
      .from('Selection')
      .select('id, billId, friendName, status')
      .eq('status', 'SELECTING')
      .limit(10)

    console.log('[DEBUG] SELECTING selections:', {
      count: selectingOnly?.length || 0,
      data: selectingOnly,
      error: selectingError
    })

    console.log('[DEBUG] ===== DEBUG SELECTIONS END =====')

    // Return comprehensive debug info
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        DATABASE_URL_SET: !!process.env.DATABASE_URL,
        SERVICE_ROLE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      tests: {
        totalCount: { count: totalCount, error: countError },
        allSelections: {
          count: allSelections?.length || 0,
          data: allSelections?.map(s => ({
            id: s.id,
            billId: s.billId,
            friendName: s.friendName,
            status: s.status,
            paid: s.paid,
            paymentMethod: s.paymentMethod
          })),
          error: allError
        },
        billSelections: billId ? {
          billId,
          count: billSelections?.length || 0,
          data: billSelections?.map((s: any) => ({
            id: s.id,
            billId: s.billId,
            friendName: s.friendName,
            status: s.status,
            paid: s.paid,
            paymentMethod: s.paymentMethod,
            itemQuantities: s.itemQuantities
          })),
          error: billError
        } : { skipped: 'No billId provided' },
        selectingSelections: {
          count: selectingOnly?.length || 0,
          data: selectingOnly,
          error: selectingError
        }
      }
    })
  } catch (error: any) {
    console.error('❌ [DEBUG] Error:', error)
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
