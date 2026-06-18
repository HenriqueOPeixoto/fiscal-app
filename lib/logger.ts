import { client } from './db'
import { randomUUID } from 'crypto'

export async function log(
  usuarioId: string,
  usuarioNome: string,
  acao: string,
  descricao: string,
) {
  try {
    await client.execute({
      sql: `INSERT INTO logs (id, usuario_id, usuario_nome, acao, descricao) VALUES (?, ?, ?, ?, ?)`,
      args: [randomUUID(), usuarioId, usuarioNome, acao, descricao],
    })
  } catch {}
}
