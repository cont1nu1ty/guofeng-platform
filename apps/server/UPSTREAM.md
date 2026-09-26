# Backend upstream

Source: https://github.com/dromara/RuoYi-Vue-Plus

Commit: `de394a0e21f1e0648ef229d027c3a927d98200a2` (6.X).

The complete original source tree and MIT license are retained. Jiafeng adds a
business module and a `compose` runtime profile. The application reactor and
entrypoint omit AI, MCP, examples, generators, external scheduling and monitoring
clients. Their original source directories remain for provenance; they are not
shipped in the Jiafeng application. Shared authentication, system management,
MyBatis, OSS and WarmFlow modules are reused.

The original database scripts are first-install inputs. A final bootstrap script
disables all upstream sample users before the API starts. Jiafeng development
accounts are initialized by the business module using generated local secrets.

Build and start from repository root with `./deploy/dev up`. Do not run the
upstream default `dev` profile: it contains upstream example configuration.
