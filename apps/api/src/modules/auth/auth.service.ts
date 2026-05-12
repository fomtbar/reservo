import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { RedisService } from '../../redis/redis.service';
import { User } from '@prisma/client';

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.active) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async login(user: Omit<User, 'passwordHash'>) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = uuidv4();

    await this.redis.set(
      `refresh:${refreshToken}`,
      JSON.stringify({ userId: user.id }),
      'EX',
      REFRESH_TTL_SECONDS,
    );

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async refresh(token: string) {
    const raw = await this.redis.get(`refresh:${token}`);
    if (!raw) throw new UnauthorizedException('Refresh token inválido o expirado');

    const { userId } = JSON.parse(raw) as { userId: string };
    const user = await this.users.findById(userId);
    if (!user || !user.active) throw new UnauthorizedException();

    // Rotate refresh token
    await this.redis.del(`refresh:${token}`);
    const { passwordHash: _, ...safeUser } = user;
    return this.login(safeUser);
  }

  async logout(token: string) {
    await this.redis.del(`refresh:${token}`);
  }
}
