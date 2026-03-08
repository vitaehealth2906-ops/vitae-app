const { PrismaClient } = require('@prisma/client');

/**
 * Singleton do PrismaClient.
 * Em desenvolvimento, armazena a instancia em globalThis para evitar
 * multiplas conexoes causadas pelo hot-reload do nodemon/ts-node.
 */

const prismaGlobal = globalThis;

const prisma =
  prismaGlobal.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.__prisma = prisma;
}

module.exports = prisma;
