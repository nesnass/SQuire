import type { LmsCommand } from './types'

interface RpcResponse<T> {
  result?: T
}

async function post<T>(playerId: string, command: LmsCommand): Promise<RpcResponse<T>> {
  const res = await fetch('/jsonrpc.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, method: 'slim.request', params: [playerId, command] }),
  })
  if (!res.ok) throw new Error(`LMS request failed: ${res.status}`)
  return res.json() as Promise<RpcResponse<T>>
}

export async function lmsQuery<T>(playerId: string, command: LmsCommand): Promise<T> {
  const body = await post<T>(playerId, command)
  if (body.result === undefined) throw new Error(`LMS returned no result for ${command.join(' ')}`)
  return body.result
}

export async function lmsCommand(playerId: string, command: LmsCommand): Promise<void> {
  await post<unknown>(playerId, command)
}
