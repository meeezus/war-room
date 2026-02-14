/**
 * Validation tests for RoleCard type and role-cards data.
 * Run with: npx tsx tests/unit/test-role-cards.ts
 */

import { getRoleCard, ROLE_CARDS } from '../../lib/role-cards'
import type { RoleCard } from '../../lib/types'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
    console.log(`  PASS: ${message}`)
  } else {
    failed++
    console.error(`  FAIL: ${message}`)
  }
}

// ---------- Test 1: getRoleCard returns valid cards ----------
console.log('\n--- getRoleCard returns valid cards ---')

const agentNames = ['pip', 'cc', 'ed', 'light', 'toji', 'power', 'makima', 'major']
for (const name of agentNames) {
  const card = getRoleCard(name)
  assert(card.id === name || (name === 'cc' && card.id === 'pip') || (name === 'makima' && card.id === 'power'),
    `getRoleCard('${name}') returns a card`)
  assert(typeof card.name === 'string' && card.name.length > 0,
    `getRoleCard('${name}').name is a non-empty string`)
}

// ---------- Test 2: Unknown agent returns fallback ----------
console.log('\n--- Unknown agent returns fallback ---')
const unknown = getRoleCard('nonexistent')
assert(unknown.id === 'unknown', 'Unknown agent returns fallback card with id "unknown"')

// ---------- Test 3: Base RoleCard fields exist ----------
console.log('\n--- Base RoleCard fields ---')
const ed = getRoleCard('ed')
assert(typeof ed.id === 'string', 'ed.id is string')
assert(typeof ed.name === 'string', 'ed.name is string')
assert(typeof ed.title === 'string', 'ed.title is string')
assert(typeof ed.class === 'string', 'ed.class is string')
assert(typeof ed.domain === 'string', 'ed.domain is string')
assert(typeof ed.emoji === 'string', 'ed.emoji is string')
assert(typeof ed.color === 'string', 'ed.color is string')
assert(typeof ed.description === 'string', 'ed.description is string')
assert(Array.isArray(ed.abilities), 'ed.abilities is array')

// ---------- Test 4: Vox-style fields exist on all cards ----------
console.log('\n--- Vox-style fields on all cards ---')
const voxFields = ['inputs', 'outputs', 'definitionOfDone', 'hardBans', 'escalation', 'metrics'] as const

for (const name of ['pip', 'ed', 'light', 'toji', 'power', 'major']) {
  const card = getRoleCard(name)
  for (const field of voxFields) {
    if (field === 'escalation') {
      assert(typeof card[field] === 'string' && (card[field] as string).length > 0,
        `${name}.${field} is a non-empty string`)
    } else {
      assert(Array.isArray(card[field]) && (card[field] as string[]).length > 0,
        `${name}.${field} is a non-empty array`)
    }
  }
}

// ---------- Test 5: Specific acceptance criteria ----------
console.log('\n--- Acceptance: ed.hardBans has 4 items ---')
const edCard = getRoleCard('ed')
assert(
  Array.isArray(edCard.hardBans) && edCard.hardBans.length === 4,
  `getRoleCard('ed').hardBans has 4 items (got ${edCard.hardBans?.length})`
)

// ---------- Test 6: Aliases resolve correctly ----------
console.log('\n--- Aliases ---')
const ccCard = getRoleCard('cc')
const pipCard = getRoleCard('pip')
assert(ccCard.name === pipCard.name, 'cc resolves to same card as pip')

const makimaCard = getRoleCard('makima')
const powerCard = getRoleCard('power')
assert(makimaCard.name === powerCard.name, 'makima resolves to same card as power')

// ---------- Test 7: cc/makima aliases have Vox fields too ----------
console.log('\n--- Alias cards have Vox fields ---')
for (const name of ['cc', 'makima']) {
  const card = getRoleCard(name)
  for (const field of voxFields) {
    if (field === 'escalation') {
      assert(typeof card[field] === 'string',
        `${name} (alias).${field} is string`)
    } else {
      assert(Array.isArray(card[field]),
        `${name} (alias).${field} is array`)
    }
  }
}

// ---------- Summary ----------
console.log('\n========================================')
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`)
if (failed > 0) {
  console.error('SOME TESTS FAILED')
  process.exit(1)
} else {
  console.log('ALL TESTS PASSED')
  process.exit(0)
}
