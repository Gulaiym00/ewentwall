import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google.service.js';
import { TokensService } from './tokens.service.js';

@Global()
@Module({
  // Secrets are passed per call (access / refresh / guest use different keys).
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokensService, GoogleService],
  exports: [TokensService, JwtModule],
})
export class AuthModule {}
