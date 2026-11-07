# Simple image: runs the Vite dev server inside a container.
FROM node:26

WORKDIR /app

# Dependencies first: this layer is cached until package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci

# Then the source code.
COPY . .

EXPOSE 5173

# --host 0.0.0.0 makes Vite reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
