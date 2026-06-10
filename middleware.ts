export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/importar/:path*', '/protocolar/:path*', '/fiscal/:path*', '/admin/:path*'],
}
