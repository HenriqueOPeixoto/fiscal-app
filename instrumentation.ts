export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDB } = await import('./lib/db')
    await initDB()

    const { iniciarMonitoramentoXml } = await import('./lib/xmlImport')
    iniciarMonitoramentoXml()
  }
}
