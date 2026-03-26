// Oura Ring API v2 client
// Fetches today's readiness and sleep scores

const OURA_API = 'https://api.ouraring.com/v2'

export interface OuraHealth {
  readiness: number | null  // 0-100 score
  sleep: number | null      // 0-100 score
  available: boolean
}

export async function getOuraHealth(): Promise<OuraHealth> {
  const token = process.env.OURA_ACCESS_TOKEN
  if (!token) {
    return { readiness: null, sleep: null, available: false }
  }

  const today = new Date().toISOString().split('T')[0]
  const headers = { Authorization: `Bearer ${token}` }

  try {
    const [readinessRes, sleepRes] = await Promise.all([
      fetch(
        `${OURA_API}/usercollection/daily_readiness?start_date=${today}&end_date=${today}`,
        { headers, next: { revalidate: 300 } }
      ),
      fetch(
        `${OURA_API}/usercollection/daily_sleep?start_date=${today}&end_date=${today}`,
        { headers, next: { revalidate: 300 } }
      ),
    ])

    const readinessData = await readinessRes.json()
    const sleepData = await sleepRes.json()

    return {
      readiness: readinessData?.data?.[0]?.score ?? null,
      sleep: sleepData?.data?.[0]?.score ?? null,
      available: true,
    }
  } catch {
    return { readiness: null, sleep: null, available: false }
  }
}
