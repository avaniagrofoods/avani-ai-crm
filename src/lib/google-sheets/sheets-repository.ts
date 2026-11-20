/**
 * TASK 5H.4 — BASE GOOGLE SHEETS REPOSITORY ABSTRACTION
 */

import { GoogleSheetsClient, defaultSheetsClient } from './google-sheets-client';
import { SheetTabName } from './sheet-schema';

export abstract class BaseSheetsRepository<TRow extends Record<string, any>> {
  protected readonly tab: SheetTabName;
  protected readonly client: GoogleSheetsClient;

  constructor(tab: SheetTabName, client: GoogleSheetsClient = defaultSheetsClient) {
    this.tab = tab;
    this.client = client;
  }

  public async findAll(): Promise<TRow[]> {
    return this.client.getAllRows<TRow>(this.tab);
  }

  public async findById(primaryKey: string): Promise<TRow | null> {
    return this.client.findRowByPrimaryKey<TRow>(this.tab, primaryKey);
  }

  public async upsert(record: TRow): Promise<{ record: TRow; created: boolean }> {
    return this.client.upsertRow<TRow>(this.tab, record);
  }

  public async insertIfAbsent(record: TRow): Promise<{ record: TRow; inserted: boolean }> {
    return this.client.insertIfAbsent<TRow>(this.tab, record);
  }

  public async deleteById(primaryKey: string): Promise<boolean> {
    return this.client.deleteRowByPrimaryKey(this.tab, primaryKey);
  }
}
