# Stage 1: Build the React application
FROM node:16.18.1-alpine as react_build

WORKDIR /app
COPY . /app/

RUN npm install
RUN npm run build

# Stage 2: Serve the React application with Nginx
FROM nginx:alpine

COPY --from=react_build /app/build /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
