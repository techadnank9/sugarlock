import { SignJWT, jwtVerify } from 'jose'

function secretKey(): Uint8Array {
  const secret = process.env.CONFIRM_TOKEN_SECRET
  if (!secret) throw new Error('CONFIRM_TOKEN_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signConfirmToken(conditionId: string): Promise<string> {
  return new SignJWT({ conditionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey())
}

export async function verifyConfirmToken(token: string): Promise<{ conditionId: string }> {
  const { payload } = await jwtVerify(token, secretKey())
  if (typeof payload.conditionId !== 'string') throw new Error('Malformed confirm token')
  return { conditionId: payload.conditionId }
}
