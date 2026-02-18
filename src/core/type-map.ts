const SF_TYPE_TO_SQLITE: Record<string, string> = {
  int: 'INTEGER',
  integer: 'INTEGER',
  boolean: 'INTEGER',
  double: 'REAL',
  currency: 'REAL',
  percent: 'REAL',
  long: 'INTEGER',
  string: 'TEXT',
  id: 'TEXT',
  reference: 'TEXT',
  textarea: 'TEXT',
  url: 'TEXT',
  email: 'TEXT',
  phone: 'TEXT',
  picklist: 'TEXT',
  multipicklist: 'TEXT',
  combobox: 'TEXT',
  date: 'TEXT',
  datetime: 'TEXT',
  time: 'TEXT',
  encryptedstring: 'TEXT',
  address: 'TEXT',
  location: 'TEXT',
  anytype: 'TEXT',
  complexvalue: 'TEXT',
  base64: 'BLOB',
};

export function sfTypeToSqlite(sfType: string): string {
  return SF_TYPE_TO_SQLITE[sfType.toLowerCase()] ?? 'TEXT';
}
