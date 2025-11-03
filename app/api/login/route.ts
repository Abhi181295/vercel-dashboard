import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const MAX_AGE = 60 * 60 * 8; // 8h

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
    const AUTH_SECRET = process.env.AUTH_SECRET || '';

    if (!AUTH_SECRET) {
      return NextResponse.json({ ok: false, error: 'AUTH_SECRET not set' }, { status: 500 });
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const alg = 'HS256';
    const token = await new SignJWT({
      sub: email,
      role: 'admin',
      // later we can add: smName: 'Manpreet Kaur Sidhu'
    })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime(`${MAX_AGE}s`)
      .sign(new TextEncoder().encode(AUTH_SECRET));

    const res = NextResponse.json({ ok: true });
    res.cookies.set('auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'login failed' }, { status: 400 });
  }
}
