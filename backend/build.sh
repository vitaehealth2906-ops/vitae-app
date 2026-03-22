#!/bin/bash
npx prisma generate
if [ -n "$DIRECT_URL" ]; then
  DATABASE_URL="$DIRECT_URL" npx prisma db push --accept-data-loss
else
  npx prisma db push --accept-data-loss
fi
