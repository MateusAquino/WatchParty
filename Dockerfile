FROM node
WORKDIR /app
ENV PORT=7860
ENV SERVER_PREFIX=H
COPY package.json /app
RUN npm install
COPY . /app
CMD ["node","index.js"]
