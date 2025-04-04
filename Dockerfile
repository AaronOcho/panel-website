FROM php:8.1-apache

RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql

RUN a2enmod rewrite

COPY . /var/www/html/

RUN chown -R www-data:www-data /var/www/html

RUN echo "session.save_handler = files" >> /usr/local/etc/php/php.ini
RUN echo "session.save_path = '/tmp'" >> /usr/local/etc/php/php.ini

EXPOSE 80