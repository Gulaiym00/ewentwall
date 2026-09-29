import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { ContentService } from './content.service.js';
import { SettingsService } from './settings.service.js';

/** Cross-cutting services used by most feature modules. */
@Global()
@Module({
  providers: [AuditService, SettingsService, ContentService],
  exports: [AuditService, SettingsService, ContentService],
})
export class PlatformModule {}
