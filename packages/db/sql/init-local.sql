-- Somente desenvolvimento local. Em produção crie os papéis com senhas fortes via secrets.
CREATE ROLE foccus_owner LOGIN PASSWORD 'foccus_owner_dev';
CREATE ROLE foccus_app LOGIN PASSWORD 'foccus_app_dev' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE foccus OWNER foccus_owner;
\c foccus
CREATE EXTENSION IF NOT EXISTS btree_gist;
