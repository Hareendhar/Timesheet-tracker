FROM node:22-slim

WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@11.9.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/timesheet-portal build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["pnpm","--filter","@workspace/api-server","start"]
