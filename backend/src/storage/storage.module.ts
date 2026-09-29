import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { LocalStorageService } from './local-storage.service.js';
import { StorageService } from './storage.service.js';
import { SupabaseStorageService } from './supabase-storage.service.js';

@Global()
@Module({
  providers: [
    LocalStorageService,
    {
      // STORAGE_DRIVER picks where files go: the local disk, or a Supabase Storage bucket in production.
      provide: StorageService,
      inject: [ConfigService, LocalStorageService],
      // Nest runs the Supabase driver's onModuleInit (bucket check) on the returned instance.
      useFactory: (config: ConfigService<Env, true>, local: LocalStorageService) =>
        config.get('STORAGE_DRIVER', { infer: true }) === 'supabase' ? new SupabaseStorageService(config) : local,
    },
  ],
  exports: [StorageService, LocalStorageService],
})
export class StorageModule {}
