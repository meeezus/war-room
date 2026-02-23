import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function ensureDynastyProject() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  const dynastyProject = {
    id: 'dynasty',
    title: 'Dynasty',
    status: 'inprogress',
    goal: 'Build the Shogunate command center',
    type: 'infrastructure',
    owner: 'sensei',
    priority: 1,
    notes: 'Meta-project for war-room development'
  }

  // Upsert - create or update
  const { data, error } = await supabase
    .from('projects')
    .upsert(dynastyProject, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    console.error('Failed to ensure Dynasty project:', error)
    process.exit(1)
  }

  console.log('Dynasty project ensured:', data.id)

  // Also ensure folio, msos, jack projects exist as stubs
  const otherProjects = [
    { id: 'folio', title: 'Folio', status: 'inprogress', type: 'product', owner: 'sensei' },
    { id: 'msos', title: 'MSOS', status: 'inprogress', type: 'product', owner: 'sensei' },
    { id: 'jack', title: 'Jack Research', status: 'inprogress', type: 'research', owner: 'sensei' }
  ]

  for (const proj of otherProjects) {
    const { error: projError } = await supabase
      .from('projects')
      .upsert(proj, { onConflict: 'id' })

    if (projError) {
      console.warn(`Warning: Could not ensure ${proj.id}:`, projError.message)
    } else {
      console.log(`Project ensured: ${proj.id}`)
    }
  }

  process.exit(0)
}

ensureDynastyProject()
