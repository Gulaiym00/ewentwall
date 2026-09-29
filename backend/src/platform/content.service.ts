import { Injectable } from '@nestjs/common';
import type { Locale, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Landing page texts (Admin → Website content). Same shape as the frontend. */
export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  faq: { q: string; a: string }[];
}

export const DEFAULT_CONTENT: Record<Locale, SiteContent> = {
  EN: {
    heroTitle: 'One event. Every moment.',
    heroSubtitle: 'Let your guests create one shared live photo wall — directly from their phones. No app. No account.',
    ctaPrimary: 'Create an event',
    ctaSecondary: 'See how it works',
    faq: [
      { q: 'Do guests need to create an account?', a: 'No. Guests simply scan the QR code and instantly access the event.' },
      { q: 'Is the photo wall updated in real time?', a: 'Yes. New photos appear on the live wall within seconds of being uploaded.' },
      { q: 'How long are photos stored?', a: 'Photos are stored for 12 months after the event.' },
    ],
  },
  RU: {
    heroTitle: 'Одно событие. Каждый момент.',
    heroSubtitle: 'Гости создают общую живую фотостену прямо со своих телефонов. Без приложений и регистрации.',
    ctaPrimary: 'Создать событие',
    ctaSecondary: 'Как это работает',
    faq: [
      { q: 'Гостям нужно регистрироваться?', a: 'Нет. Достаточно отсканировать QR-код, и гость сразу попадает на событие.' },
      { q: 'Фотостена обновляется в реальном времени?', a: 'Да. Новые фото появляются на стене через несколько секунд после загрузки.' },
      { q: 'Сколько хранятся фотографии?', a: 'Фото хранятся 12 месяцев после события.' },
    ],
  },
};

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async get(locale: Locale): Promise<SiteContent> {
    const row = await this.prisma.siteContent.findUnique({ where: { locale } });
    return (row?.data as SiteContent | undefined) ?? DEFAULT_CONTENT[locale];
  }

  async set(locale: Locale, content: SiteContent): Promise<SiteContent> {
    const data = content as unknown as Prisma.InputJsonValue;
    await this.prisma.siteContent.upsert({ where: { locale }, create: { locale, data }, update: { data } });
    return content;
  }
}
