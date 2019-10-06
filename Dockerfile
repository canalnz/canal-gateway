FROM node:10

ARG NPM_TOKEN
WORKDIR /usr/src/app

# Wild card for package.json & package-lock.json
# Seperate command for cp package.json so that it doesn't reinstall every source change
# Copies creds for install, then removes them
COPY package*.json ./
COPY .npmrc.ci ./.npmrc
RUN npm install
RUN rm -f .npmrc

# Copy source
COPY . .

ENV NODE_ENV production

RUN npm run build

USER node

CMD ["npm", "start"]
