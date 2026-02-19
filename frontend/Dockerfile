FROM node:latest

# Working directory

WORKDIR /usr/src/app

# Copy JSON Package

COPY package*.json ./

#Install

RUN npm install prettier -g
RUN npm install

#COPY files

COPY . .

#RUN
#RUN npm run dev

#Expose
EXPOSE 3000

#Run app
CMD ["npm","start"]