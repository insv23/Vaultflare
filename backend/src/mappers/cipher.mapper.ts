// input: raw D1 rows from ciphers table.
// output: API-facing cipher objects with stable field names.
// pos: data translation boundary between SQL rows and HTTP responses.

type CipherRow = {
  id: string;
  encrypted_dek: string;
  encrypted_data: string;
  item_version: number;
  vault_version: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

export const mapCipher = (row: CipherRow) => ({
  cipher_id: row.id,
  encrypted_dek: row.encrypted_dek,
  encrypted_data: row.encrypted_data,
  item_version: Number(row.item_version),
  vault_version: Number(row.vault_version),
  deleted_at: row.deleted_at === null ? null : Number(row.deleted_at),
  created_at: Number(row.created_at),
  updated_at: Number(row.updated_at),
});

export const mapCipherList = (rows: CipherRow[]) => rows.map(mapCipher);
