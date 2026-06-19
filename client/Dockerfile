FROM nginx:stable-alpine
WORKDIR /app
COPY index.html app.js env-config.js docker-entrypoint.sh /usr/share/nginx/html/
RUN chmod +x /usr/share/nginx/html/docker-entrypoint.sh
EXPOSE 80
CMD ["/usr/share/nginx/html/docker-entrypoint.sh"]
