# SearXNG (local) for Asagiri

Self-hosted meta-search endpoint. Runs on `127.0.0.1:8888` (bound to loopback — not exposed to LAN). Consumed by `engine/search.py`.

Port 8888 chosen because 8080 was already taken by an `ApplicationWebServer` background process on Karasuma. Inside the container SearXNG still listens on 8080; the host-side mapping is what differs.

## Setup (first time only)

```bash
cp infra/searxng/settings.example.yml infra/searxng/settings.yml
python -c "import secrets; print(secrets.token_hex(32))"  # paste into settings.yml secret_key
```

`settings.yml` is gitignored because it contains the secret.

## Start

```bash
docker compose -f infra/searxng/docker-compose.yml up -d
```

## Verify

```bash
curl 'http://localhost:8888/search?q=test&format=json' | jq '.results[0]'
```

## Stop

```bash
docker compose -f infra/searxng/docker-compose.yml down
```

## Notes

- `settings.yml` enables both `html` and `json` formats. JSON is needed for `engine/search.py`.
- `limiter: false` because all calls come from one local client. Re-enable if exposing.
- Secret key is set per-clone via `settings.yml` (gitignored). Rotate if ever exposing the instance.
- Bound to `127.0.0.1` in `docker-compose.yml` ports mapping; inside container listens on `0.0.0.0:8080`.
