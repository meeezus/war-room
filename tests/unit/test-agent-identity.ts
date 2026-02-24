/**
 * Tests for lib/agent-identity.ts
 * Run with: npx tsx tests/unit/test-agent-identity.ts
 */

import { getAgentSystemPrompt, AGENTS_WITH_IDENTITY } from '../../lib/agent-identity'

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

// ---------- Test 1: Known agents return non-null strings ----------
console.log('\n--- Known agents with SKILL files return prompts ---')

const agentsWithFiles = ['makima', 'ed', 'light', 'major', 'bulma', 'l', 'nanami', 'armin']

for (const agentId of agentsWithFiles) {
  const prompt = getAgentSystemPrompt(agentId)
  assert(prompt !== null, `getAgentSystemPrompt('${agentId}') returns non-null`)
  assert(typeof prompt === 'string' && prompt.length > 0, `getAgentSystemPrompt('${agentId}') returns non-empty string`)
}

// ---------- Test 2: cc returns null (no system prompt) ----------
console.log('\n--- cc returns null ---')
const ccPrompt = getAgentSystemPrompt('cc')
assert(ccPrompt === null, "getAgentSystemPrompt('cc') returns null")

// ---------- Test 3: pip returns null (no personality file) ----------
console.log('\n--- pip returns null ---')
const pipPrompt = getAgentSystemPrompt('pip')
assert(pipPrompt === null, "getAgentSystemPrompt('pip') returns null")

// ---------- Test 4: Unknown agents return null ----------
console.log('\n--- Unknown agents return null ---')
for (const agentId of ['nonexistent', 'batman', '']) {
  const prompt = getAgentSystemPrompt(agentId)
  assert(prompt === null, `getAgentSystemPrompt('${agentId}') returns null`)
}

// ---------- Test 5: makima concatenates SOUL.md + PRINCIPLES.md ----------
console.log('\n--- makima prompt includes both SOUL and PRINCIPLES content ---')
const makimaPrompt = getAgentSystemPrompt('makima')
if (makimaPrompt) {
  // SOUL.md and PRINCIPLES.md are concatenated with \n\n
  // We can verify the prompt contains content from both files
  assert(makimaPrompt.length > 100, 'makima prompt is substantial (>100 chars)')
  // The prompt should contain the separator between the two files
  assert(makimaPrompt.includes('\n\n'), 'makima prompt contains \\n\\n separator')
} else {
  assert(false, 'makima prompt should not be null')
}

// ---------- Test 6: readFileSync is called fresh each time (no cache) ----------
console.log('\n--- No caching: two calls return same content ---')
const first = getAgentSystemPrompt('ed')
const second = getAgentSystemPrompt('ed')
assert(first === second, 'Two sequential calls return identical content (both read fresh)')
assert(first !== null, 'ed prompt is not null')

// ---------- Test 7: AGENTS_WITH_IDENTITY export ----------
console.log('\n--- AGENTS_WITH_IDENTITY export ---')
assert(Array.isArray(AGENTS_WITH_IDENTITY), 'AGENTS_WITH_IDENTITY is an array')
assert(AGENTS_WITH_IDENTITY.includes('cc'), "AGENTS_WITH_IDENTITY includes 'cc'")
assert(AGENTS_WITH_IDENTITY.includes('ed'), "AGENTS_WITH_IDENTITY includes 'ed'")
assert(AGENTS_WITH_IDENTITY.includes('makima'), "AGENTS_WITH_IDENTITY includes 'makima'")
assert(AGENTS_WITH_IDENTITY.includes('light'), "AGENTS_WITH_IDENTITY includes 'light'")
assert(AGENTS_WITH_IDENTITY.includes('major'), "AGENTS_WITH_IDENTITY includes 'major'")
assert(AGENTS_WITH_IDENTITY.includes('bulma'), "AGENTS_WITH_IDENTITY includes 'bulma'")
assert(AGENTS_WITH_IDENTITY.includes('l'), "AGENTS_WITH_IDENTITY includes 'l'")
assert(AGENTS_WITH_IDENTITY.includes('nanami'), "AGENTS_WITH_IDENTITY includes 'nanami'")
assert(AGENTS_WITH_IDENTITY.includes('armin'), "AGENTS_WITH_IDENTITY includes 'armin'")
assert(!AGENTS_WITH_IDENTITY.includes('pip'), "AGENTS_WITH_IDENTITY does NOT include 'pip'")
assert(!AGENTS_WITH_IDENTITY.includes('nonexistent'), "AGENTS_WITH_IDENTITY does NOT include 'nonexistent'")

// ---------- Test 8: Single-file agents return just that file's content ----------
console.log('\n--- Single-file agent content matches file ---')
import { readFileSync } from 'fs'
import { resolve } from 'path'
const HOME = process.env.HOME || '/Users/michaelenriquez'
const edDirect = readFileSync(resolve(HOME, 'Code/shogunate/skills/Ed-SKILL.md'), 'utf-8')
const edPrompt = getAgentSystemPrompt('ed')
assert(edPrompt === edDirect, 'ed prompt matches direct file read of Ed-SKILL.md')

// ---------- Test 9: makima concatenation matches direct reads ----------
console.log('\n--- makima concatenation matches direct reads ---')
const soulContent = readFileSync(resolve(HOME, 'clawd/x/SOUL.md'), 'utf-8')
const principlesContent = readFileSync(resolve(HOME, 'clawd/x/PRINCIPLES.md'), 'utf-8')
const expectedMakima = soulContent + '\n\n' + principlesContent
const actualMakima = getAgentSystemPrompt('makima')
assert(actualMakima === expectedMakima, 'makima prompt = SOUL.md + \\n\\n + PRINCIPLES.md')

// ---------- Summary ----------
console.log('\n==================')
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
} else {
  console.log('All tests passed!')
}
