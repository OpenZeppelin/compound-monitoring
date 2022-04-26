# Build stage: obfuscate Javascript (optional)
# FROM node:14.15.5-alpine as builder
# WORKDIR /app
# COPY . .
# RUN npm install -g javascript-obfuscator
# RUN javascript-obfuscator ./src --output ./dist --split-strings true --split-strings-chunk-length 3

# Final stage: install production dependencies
FROM node:12-alpine
ENV NODE_ENV=production
# Uncomment the following line to enable agent logging
# LABEL "network.forta.settings.agent-logs.enable"="true"
WORKDIR /app
# if using obfuscated code from build stage:
# COPY --from=builder /app/dist ./src
# else if using unobfuscated code:
COPY ./src ./src
COPY package*.json ./
RUN npm ci --production
CMD [ "npm", "run", "start:prod" ]