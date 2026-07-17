# vu-backend deploy (GitHub Actions + PM2)

On every push to `main`, `.github/workflows/deploy.yml`:
1. Builds the app on the GitHub runner (`npm ci` + `npm run build` → `dist/`).
2. Copies `dist/`, `package*.json`, `ecosystem.config.js` to the EC2 host over SSH.
3. On the host: `npm ci --omit=dev`, then `pm2 reload` (zero-downtime restart).

## One-time EC2 setup (Ubuntu)

```bash
# 1. PM2 (Node/npm already installed since the app runs)
sudo npm install -g pm2

# 2. Make sure .env exists in the app dir (dotenv loads it; it is NOT shipped
#    by the pipeline — it stays on the server). See repo .env.example.
cd /path/to/app          # this path becomes the APP_DIR secret
nano .env

# 3. First start under PM2 (the pipeline uses `pm2 reload` after this)
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup            # run the command it prints, so PM2 survives reboots
```

## GitHub secrets (repo → Settings → Secrets and variables → Actions)

| Secret | Value |
| --- | --- |
| `EC2_HOST` | EC2 public IP / DNS |
| `EC2_SSH_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Private SSH key (PEM contents) authorized on the host |
| `EC2_SSH_PORT` | *(optional)* defaults to 22 |
| `APP_DIR` | Absolute path to the app on EC2, e.g. `/home/ubuntu/vu-backend` |

## Rollback

Re-run the previous successful deploy from the Actions tab, or on the host:

```bash
pm2 logs backend      # inspect
pm2 reload backend    # restart current build
```
