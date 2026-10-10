import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { ContentService } from './content.service.js';
import { MailService } from './mail.service.js';
import { SettingsService } from './settings.service.js';

/** Cross-cutting services used by most feature modules. */
@Global()
@Module({
  providers: [AuditService, SettingsService, ContentService, MailService],
  exports: [AuditService, SettingsService, ContentService, MailService],
})
export class PlatformModule {}
