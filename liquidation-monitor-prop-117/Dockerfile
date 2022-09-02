# Final stage: install production dependencies
FROM node:16.17.0-slim
ENV NODE_ENV=production
LABEL "network.forta.settings.agent-logs.enable"="true"
WORKDIR /app
# if using obfuscated code from build stage:
# COPY --from=builder /app/dist ./src
# else if using unobfuscated code:
COPY ./src ./src
COPY ./abi ./abi
COPY ./bot-config.json ./bot-config.json
COPY data.json ./
COPY package*.json ./
RUN npm ci --production
CMD [ "npm", "run", "start:prod" ]
