import { Body, Controller, Get, Param, Post, Query, Req, Sse, UploadedFiles, UseGuards, UseInterceptors, type MessageEvent } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { from, switchMap, type Observable } from 'rxjs';
import type { Request } from 'express';
import { clientIp, CurrentGuest, OptionalGuest, Public, type AuthGuest } from '../common/auth.js';
import { byIp } from '../common/throttle.js';
import { GuestTokenGuard, OptionalGuestGuard } from '../common/guards.js';
import { JoinEventDto, ListPhotosQuery, UploadCaptionDto } from './guest.dto.js';
import { GuestService } from './guest.service.js';

// Hard ceiling for the multipart parser; the real limits come from platform settings.
const MULTER_LIMITS = { fileSize: 50 * 1024 * 1024, files: 50 };
// Uploads go to temp files, not RAM: a few big uploads at once would not fit the free server's ~512 MB.
const UPLOAD_TMP = join(tmpdir(), 'eventwall-uploads');

/** Public guest API behind the QR code: /e/{slug}. No account needed. */
@ApiTags('guest')
@Public()
@Controller('e/:slug')
export class GuestController {
  constructor(private readonly guests: GuestService) {}

  @Get()
  @ApiOperation({ summary: 'Event page for guests (cover, welcome text, counters, what is allowed)' })
  event(@Param('slug') slug: string) {
    return this.guests.publicEvent(slug);
  }

  @Post('join')
  // A whole venue joins from one Wi-Fi IP at once; wrong PINs have their own stricter limit in GuestService.join
  @Throttle({ default: { limit: 120, ttl: 60_000, getTracker: byIp } })
  @ApiOperation({ summary: 'Enter the event (optional name, PIN if required) → guest token' })
  join(@Param('slug') slug: string, @Body() dto: JoinEventDto, @Req() req: Request) {
    return this.guests.join(slug, dto, clientIp(req));
  }

  @Get('photos')
  @UseGuards(OptionalGuestGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Live wall feed. With a guest token: your reactions marked, sort=mine available' })
  photos(@Param('slug') slug: string, @Query() query: ListPhotosQuery, @OptionalGuest() guest?: AuthGuest) {
    return this.guests.photos(slug, query, guest);
  }

  @Post('photos')
  @UseGuards(GuestTokenGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Upload photos (multipart "files", optional "caption")' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } }, caption: { type: 'string' } },
    },
  })
  @UseInterceptors(FilesInterceptor('files', MULTER_LIMITS.files, { dest: UPLOAD_TMP, limits: MULTER_LIMITS }))
  upload(
    @Param('slug') slug: string,
    @CurrentGuest() guest: AuthGuest,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadCaptionDto,
  ) {
    return this.guests.upload(slug, guest, files, body.caption);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Server-Sent Events: photo.published / photo.removed for the live wall' })
  stream(@Param('slug') slug: string, @Query('token') token?: string): Observable<MessageEvent> {
    return from(this.guests.streamFor(slug, token)).pipe(switchMap(stream => stream));
  }
}
