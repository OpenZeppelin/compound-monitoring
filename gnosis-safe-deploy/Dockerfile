# Final stage: install production dependencies
FROM node:12-alpine
ENV NODE_ENV=production
WORKDIR /app
# if using obfuscated code from build stage:
# COPY --from=builder /app/dist ./src
# else if using unobfuscated code:
# COPY ./src ./src
# COPY ./abi ./abi
# COPY agent-config.json ./
# COPY package*.json ./
# RUN npm ci --production
# CMD [ "npm", "run", "start:prod" ]
