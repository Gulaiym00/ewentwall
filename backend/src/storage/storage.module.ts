import { Global, Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service.js';
import { StorageService } from './storage.service.js';

@Global()
@Module({
  providers: [
    LocalStorageService,
    // Swap useExisting for an S3 driver when STORAGE_DRIVER=s3 is added.
    { provide: StorageService, useExisting: LocalStorageService },
  ],
  exports: [StorageService, LocalStorageService],
})
export class StorageModule {}
