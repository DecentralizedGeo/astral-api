FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install --include=dev

# Rebuild symlinks to fix Docker symbolic link issues
RUN npm rebuild

COPY . .

RUN node ./node_modules/typescript/bin/tsc

# Make initialization script executable
RUN chmod +x scripts/docker-init.sh

EXPOSE 3000

# Use initialization script as entrypoint
CMD ["./scripts/docker-init.sh"]